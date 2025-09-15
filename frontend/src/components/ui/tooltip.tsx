import React, { useState, useRef, useEffect, ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  children: React.ReactElement;
  content: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  delayDuration?: number;
  className?: string;
}

export function Tooltip({
  children,
  content,
  side = 'bottom',
  align = 'center',
  delayDuration = 700,
  className = ''
}: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);
  const triggerRef = useRef<HTMLElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Position calculations
  const getTooltipPosition = () => {
    if (!triggerRef.current) return { top: 0, left: 0 };

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current?.getBoundingClientRect() || { width: 0, height: 0 };
    
    const offset = 8; // Space between trigger and tooltip
    let top = 0;
    let left = 0;

    // Calculate vertical position
    switch (side) {
      case 'top':
        top = triggerRect.top - tooltipRect.height - offset;
        break;
      case 'bottom':
        top = triggerRect.bottom + offset;
        break;
      case 'left':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        break;
      case 'right':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        break;
    }

    // Calculate horizontal position
    switch (side) {
      case 'top':
      case 'bottom':
        switch (align) {
          case 'start':
            left = triggerRect.left;
            break;
          case 'center':
            left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
            break;
          case 'end':
            left = triggerRect.right - tooltipRect.width;
            break;
        }
        break;
      case 'left':
        left = triggerRect.left - tooltipRect.width - offset;
        break;
      case 'right':
        left = triggerRect.right + offset;
        break;
    }

    // Viewport boundaries adjustment
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    // Horizontal boundaries
    if (left < 8) left = 8;
    if (left + tooltipRect.width > viewport.width - 8) {
      left = viewport.width - tooltipRect.width - 8;
    }

    // Vertical boundaries
    if (top < 8) top = 8;
    if (top + tooltipRect.height > viewport.height - 8) {
      top = viewport.height - tooltipRect.height - 8;
    }

    return { top, left };
  };

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      setShouldShow(true);
    }, delayDuration);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setShouldShow(false);
  };

  const handleFocus = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setShouldShow(true);
  };

  const handleBlur = () => {
    setShouldShow(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setShouldShow(false);
    }
  };

  // Update tooltip visibility with animation
  useEffect(() => {
    if (shouldShow) {
      setIsOpen(true);
    } else {
      // Delay hiding to allow for exit animation
      const hideTimeout = setTimeout(() => setIsOpen(false), 150);
      return () => clearTimeout(hideTimeout);
    }
  }, [shouldShow]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Clone trigger element with event handlers
  const trigger = React.cloneElement(children, {
    ref: triggerRef,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onFocus: handleFocus,
    onBlur: handleBlur,
    onKeyDown: handleKeyDown,
    'aria-describedby': shouldShow ? 'tooltip' : undefined,
  });

  const tooltipContent = isOpen ? createPortal(
    <div
      ref={tooltipRef}
      id="tooltip"
      role="tooltip"
      className={`
        fixed z-50 px-3 py-2 text-xs font-medium text-card-foreground bg-card rounded-md shadow-lg
        border border-border max-w-xs break-words
        transition-opacity duration-150
        ${shouldShow ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        ${className}
      `}
      style={getTooltipPosition()}
    >
      {content}
      {/* Tooltip arrow */}
      <div
        className={`absolute w-2 h-2 bg-card border border-border rotate-45 ${
          side === 'top' ? 'bottom-[-5px] left-1/2 transform -translate-x-1/2 border-t-0 border-l-0' :
          side === 'bottom' ? 'top-[-5px] left-1/2 transform -translate-x-1/2 border-b-0 border-r-0' :
          side === 'left' ? 'right-[-5px] top-1/2 transform -translate-y-1/2 border-b-0 border-l-0' :
          'left-[-5px] top-1/2 transform -translate-y-1/2 border-t-0 border-r-0'
        }`}
      />
    </div>,
    document.body
  ) : null;

  return (
    <>
      {trigger}
      {tooltipContent}
    </>
  );
}