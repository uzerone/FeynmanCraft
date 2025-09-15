#!/usr/bin/env python3
"""
SSE Event Bus for FeynmanCraft ADK
Provides ordered event streaming with replay capability and heartbeat
"""

import asyncio
import json
import time
import logging
from typing import Dict, Any, AsyncIterator, List, Optional, Set

logger = logging.getLogger(__name__)

# Global state
SEQ = 0
RING: List[Dict[str, Any]] = []  # Ring buffer for event replay
RING_MAX = 5000
SUBS: Set[asyncio.Queue] = set()  # Active subscriber queues

def _next_seq() -> int:
    """Generate next sequence number for event ordering"""
    global SEQ
    SEQ += 1
    return SEQ

def _pack_event(evt: Dict[str, Any]) -> Dict[str, Any]:
    """Pack event with server metadata"""
    evt.setdefault("ts", time.time())
    evt["seq"] = _next_seq()
    return evt

def publish(evt: Dict[str, Any]) -> None:
    """Publish event to all subscribers with ring buffer storage"""
    packed_event = _pack_event(evt)
    
    # Store in ring buffer for replay
    RING.append(packed_event)
    if len(RING) > RING_MAX:
        RING.pop(0)
    
    # Distribute to active subscribers
    dead_queues = set()
    for q in list(SUBS):
        try:
            q.put_nowait(packed_event)
        except asyncio.QueueFull:
            logger.warning("Subscriber queue full, dropping event")
            # Don't remove queue yet, let client handle backpressure
        except Exception as e:
            logger.error(f"Error publishing to subscriber: {e}")
            dead_queues.add(q)
    
    # Clean up dead queues
    SUBS.difference_update(dead_queues)
    
    logger.debug(f"Published event seq={packed_event['seq']} to {len(SUBS)} subscribers")

async def stream(since: Optional[int] = None) -> AsyncIterator[bytes]:
    """Stream events to SSE client with replay capability"""
    # Create subscriber queue with backpressure handling
    q: asyncio.Queue = asyncio.Queue(maxsize=2000)
    SUBS.add(q)
    client_id = id(q)
    logger.info(f"New SSE subscriber {client_id}, total: {len(SUBS)}")
    
    try:
        # Replay missed events if requested
        if since is not None:
            replay_count = 0
            for event in RING:
                if event["seq"] > since:
                    yield _format_sse(event)
                    replay_count += 1
            if replay_count > 0:
                logger.info(f"Replayed {replay_count} events for client {client_id}")
        
        # Send connection confirmation
        yield _format_sse({
            "type": "server.ready",
            "seq": SEQ,
            "ts": time.time(),
            "message": "SSE connection established",
            "total_subscribers": len(SUBS)
        })
        
        # Stream live events with heartbeat
        last_heartbeat = time.time()
        while True:
            try:
                # Wait for event with timeout for heartbeat
                event = await asyncio.wait_for(q.get(), timeout=5.0)
                yield _format_sse(event)
                q.task_done()
            except asyncio.TimeoutError:
                # Send heartbeat every 5 seconds
                current_time = time.time()
                if current_time - last_heartbeat >= 5:
                    yield _format_sse({
                        "type": "heartbeat",
                        "ts": current_time,
                        "seq": SEQ,
                        "active_subscribers": len(SUBS)
                    })
                    last_heartbeat = current_time
    
    except asyncio.CancelledError:
        logger.info(f"SSE client {client_id} cancelled")
        raise
    except Exception as e:
        logger.error(f"Error in SSE stream for client {client_id}: {e}")
        raise
    finally:
        # Cleanup on disconnect
        SUBS.discard(q)
        logger.info(f"SSE client {client_id} disconnected, remaining: {len(SUBS)}")

def _format_sse(data: Dict[str, Any]) -> bytes:
    """Format event data for SSE transmission"""
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n".encode('utf-8')

def get_stats() -> Dict[str, Any]:
    """Get current bus statistics"""
    return {
        "active_subscribers": len(SUBS),
        "ring_buffer_size": len(RING),
        "ring_buffer_max": RING_MAX,
        "current_seq": SEQ,
        "oldest_seq": RING[0]["seq"] if RING else None,
        "newest_seq": RING[-1]["seq"] if RING else None,
        "uptime": time.time()
    }

def reset_for_testing():
    """Reset global state for testing (not for production)"""
    global SEQ, RING, SUBS
    SEQ = 0
    RING.clear()
    SUBS.clear()
    logger.warning("SSE bus reset for testing")