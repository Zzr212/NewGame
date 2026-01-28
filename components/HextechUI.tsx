import React from 'react';

// --- Colors ---
// Gold: #C8AA6E
// Dark Blue: #091428
// Medium Blue: #1E2328
// Highlight: #0AC8B9

export const HexCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`relative p-0.5 bg-gradient-to-b from-[#C8AA6E] via-[#785A28] to-[#C8AA6E] ${className}`}>
    <div className="bg-[#091428] w-full h-full relative border border-[#1E2328]">
      {/* Decorative Corners */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-[#C8AA6E]" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-[#C8AA6E]" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-[#C8AA6E]" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-[#C8AA6E]" />
      
      <div className="p-4 relative z-10">
        {children}
      </div>
    </div>
  </div>
);

export const HexButton: React.FC<{ 
  onClick?: () => void; 
  disabled?: boolean; 
  children: React.ReactNode; 
  variant?: 'primary' | 'danger' | 'secondary' 
}> = ({ onClick, disabled, children, variant = 'primary' }) => {
  
  let bgClass = "bg-[#1E2328]";
  let borderClass = "border-[#C8AA6E]";
  let textClass = "text-[#F0E6D2]";
  let hoverClass = "hover:bg-[#1E282D] hover:shadow-[0_0_10px_#C8AA6E]";

  if (variant === 'primary') {
    bgClass = "bg-[#1E2328]";
    borderClass = "border-[#0AC8B9]";
    hoverClass = "hover:brightness-125 hover:shadow-[0_0_15px_#0AC8B9]";
  } else if (variant === 'danger') {
    bgClass = "bg-[#280909]";
    borderClass = "border-[#FF4655]";
    hoverClass = "hover:brightness-125 hover:shadow-[0_0_15px_#FF4655]";
  }

  if (disabled) {
    hoverClass = "";
    bgClass = "bg-gray-900 opacity-50 cursor-not-allowed";
    borderClass = "border-gray-700";
  }

  return (
    <button
      onClick={disabled ? undefined : onClick}
      className={`
        relative px-8 py-3 w-full sm:w-auto
        border-2 ${borderClass} ${bgClass} ${textClass}
        uppercase tracking-widest font-bold hextech-font
        transition-all duration-200
        ${hoverClass}
        group
      `}
    >
      <span className="relative z-10 drop-shadow-md">{children}</span>
      {!disabled && (
        <div className="absolute inset-0 opacity-0 group-hover:opacity-20 bg-white transition-opacity duration-200" />
      )}
    </button>
  );
};

export const HexInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <div className="relative group">
    <input
      {...props}
      className={`
        w-full bg-[#010A13] border border-[#785A28] 
        text-[#F0E6D2] px-4 py-3 
        focus:outline-none focus:border-[#0AC8B9] focus:shadow-[0_0_10px_#0AC8B940]
        placeholder-gray-600 font-sans tracking-wide
        transition-all duration-300
        ${props.className}
      `}
    />
    <div className="absolute bottom-0 left-0 w-0 h-0.5 bg-[#0AC8B9] transition-all duration-300 group-focus-within:w-full" />
  </div>
);

export const StatusOrb: React.FC<{ active: boolean }> = ({ active }) => (
  <div className={`
    w-3 h-3 rounded-full border border-black shadow-lg
    ${active 
      ? 'bg-[#0AC8B9] shadow-[0_0_8px_#0AC8B9]' 
      : 'bg-gray-800 border-gray-600'}
  `} />
);
