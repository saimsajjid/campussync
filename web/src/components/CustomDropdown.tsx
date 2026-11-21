import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface DropdownOption<T = string> {
  value: T;
  label: string;
  badge?: string | number;
  icon?: React.ReactNode;
  description?: string;
  disabled?: boolean;
}

interface CustomDropdownProps<T = string> {
  value: T;
  onChange: (value: T) => void;
  options: DropdownOption<T>[];
  labelPrefix?: string;
  icon?: React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  align?: 'left' | 'right';
  direction?: 'down' | 'up' | 'auto';
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
}

export function CustomDropdown<T = string>({
  value,
  onChange,
  options,
  labelPrefix,
  icon,
  disabled = false,
  size = 'md',
  align = 'left',
  direction = 'auto',
  className = '',
  buttonClassName = '',
  menuClassName = '',
}: CustomDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [computedDirection, setComputedDirection] = useState<'down' | 'up'>('down');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (disabled) return;

    if (!isOpen && direction === 'auto' && dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const estimatedMenuHeight = Math.min(options.length * 36 + 16, 240);

      if (spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow) {
        setComputedDirection('up');
      } else {
        setComputedDirection('down');
      }
    } else if (direction !== 'auto') {
      setComputedDirection(direction);
    }

    setIsOpen(!isOpen);
  };

  const handleSelect = (optionValue: T) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  const isSmall = size === 'sm';

  return (
    <div
      ref={dropdownRef}
      className={`relative inline-block text-left w-full sm:w-auto ${className}`}
    >
      {/* Trigger Button - shadcn SelectTrigger style */}
      <button
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={`w-full flex items-center justify-between gap-2 bg-white border border-zinc-200 hover:border-zinc-300 rounded-lg font-medium text-zinc-900 shadow-2xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-hidden focus:ring-1 focus:ring-zinc-950 ${
          isSmall ? 'py-1.5 px-3 text-xs h-8' : 'py-2 px-3 text-sm h-9'
        } ${isOpen ? 'ring-1 ring-zinc-950 border-zinc-950' : ''} ${buttonClassName}`}
      >
        <div className="flex items-center gap-2 truncate">
          {icon && <span className="text-zinc-500 shrink-0">{icon}</span>}
          {labelPrefix && (
            <span className="text-zinc-500 font-normal shrink-0">{labelPrefix}</span>
          )}
          <span className="truncate">{selectedOption?.label}</span>
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-zinc-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-zinc-900' : ''
          }`}
        />
      </button>

      {/* Floating Menu - shadcn SelectContent style */}
      {isOpen && (
        <div
          className={`absolute ${
            computedDirection === 'up'
              ? 'bottom-full mb-1.5 origin-bottom'
              : 'top-full mt-1.5 origin-top'
          } min-w-full w-max max-w-xs sm:max-w-sm bg-white rounded-lg shadow-lg border border-zinc-200 p-1 z-50 animate-in fade-in-80 zoom-in-95 duration-100 ${
            align === 'right' ? 'right-0' : 'left-0'
          } ${menuClassName}`}
        >
          <div className="max-h-60 overflow-y-auto space-y-0.5">
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  className={`w-full flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors text-left cursor-pointer ${
                    isSelected
                      ? 'bg-zinc-100 text-zinc-900 font-semibold'
                      : 'text-zinc-700 hover:bg-zinc-100/70 hover:text-zinc-900'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {opt.icon && <span className="text-sm shrink-0 text-zinc-500">{opt.icon}</span>}
                    <div className="truncate">
                      <div className="truncate">{opt.label}</div>
                      {opt.description && (
                        <div className="text-[10px] text-zinc-400 font-normal truncate">
                          {opt.description}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {opt.badge && (
                      <span className="text-[10px] bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded font-medium border border-zinc-200/60">
                        {opt.badge}
                      </span>
                    )}
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-zinc-900 shrink-0 stroke-[2.5]" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
