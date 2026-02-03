import React, { useState, useId } from 'react';

interface TooltipProps {
  content: React.ReactNode;
  // Fix: Specify 'any' for the element's props to allow cloning with additional attributes like 'aria-describedby'.
  children: React.ReactElement<any>;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

const Tooltip: React.FC<TooltipProps> = ({ content, children, position = 'top', className }) => {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipId = useId();

  const show = () => setIsVisible(true);
  const hide = () => setIsVisible(false);

  const getTooltipPosition = () => {
    switch (position) {
      case 'bottom':
        return { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: '8px' };
      case 'left':
        return { top: '50%', right: '100%', transform: 'translateY(-50%)', marginRight: '8px' };
      case 'right':
        return { top: '50%', left: '100%', transform: 'translateY(-50%)', marginLeft: '8px' };
      case 'top':
      default:
        return { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '8px' };
    }
  };
  
  const getArrowPosition = () => {
     switch (position) {
      case 'bottom':
        return { bottom: '100%', left: '50%', transform: 'translateX(-50%)', borderWidth: '0 6px 6px 6px', borderColor: 'transparent transparent #1e293b transparent' };
      case 'left':
        return { top: '50%', left: '100%', transform: 'translateY(-50%)', borderWidth: '6px 0 6px 6px', borderColor: 'transparent transparent transparent #1e293b' };
      case 'right':
        return { top: '50%', right: '100%', transform: 'translateY(-50%)', borderWidth: '6px 6px 6px 0', borderColor: 'transparent #1e293b transparent transparent' };
      case 'top':
      default:
        return { top: '100%', left: '50%', transform: 'translateX(-50%)', borderWidth: '6px 6px 0 6px', borderColor: '#1e293b transparent transparent transparent' };
    }
  }

  // Fix: The original implementation using React.cloneElement to add event handlers
  // caused a TypeScript error because the child's props are not known to accept
  // DOM events. This revised implementation moves the event handlers to the
  // wrapper div, which is more robust. `onFocusCapture` and `onBlurCapture` are
  // used to correctly detect focus changes within the child element(s).
  return (
    <div
      className={`relative inline-flex ${className || ''}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocusCapture={show}
      onBlurCapture={hide}
    >
      {React.cloneElement(children, {
        'aria-describedby': isVisible ? tooltipId : undefined,
      })}
      {isVisible && (
        <div
          id={tooltipId}
          role="tooltip"
          className="absolute z-[150] w-max max-w-xs p-2.5 text-center text-sm font-medium text-white bg-slate-800 rounded-lg shadow-xl"
          style={getTooltipPosition()}
        >
          {content}
          <div className="absolute w-0 h-0 border-solid pointer-events-none" style={getArrowPosition()}></div>
        </div>
      )}
    </div>
  );
};

export default Tooltip;