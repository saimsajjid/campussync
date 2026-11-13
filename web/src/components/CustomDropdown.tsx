import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface DropdownOption<T extends string | number> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  badge?: string;
  description?: string;
}

interface CustomDropdownProps<T extends string | number> {
  value: T;
  onChange: (value: T) => void;
  options: DropdownOption<T>[];
  labelPrefix?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  align?: 'left' | 'right';
  direction?: 'up' | 'down' | 'auto';
  size?: 'sm' | 'md';
}

export function CustomDropdown<T extends string | number>({
  value,
  onChange,
  options,
  labelPrefix,
  icon,
  disabled = false,
  className = '',
  buttonClassName = '',
  menuClassName = '',
  align = 'left',
  direction = 'auto',
  size = 'md',
}: CustomDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [computedDirection, setComputedDirection] = useState<'up' | 'down'>(
    direction === 'up' ? 'up' : 'down'
  );

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  const calculateDirection = (): 'up' | 'down' => {
    if (direction === 'up') return 'up';
    if (direction === 'down') return 'down';
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      if (spaceBelow < 220 && spaceAbove > spaceBelow) {
        return 'up';
      }
    }
    return 'down';
  };

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      setComputedDirection(calculateDirection());
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Recalculate direction if auto
  useEffect(() => {
    if (isOpen && direction === 'auto') {
      const handleReposition = () => {
        setComputedDirection(calculateDirection());
      };
      window.addEventListener('scroll', handleReposition, true);
      window.addEventListener('resize', handleReposition);
      return () => {
        window.removeEventListener('scroll', handleReposition, true);
        window.removeEventListener('resize', handleReposition);
      };
    }
  }, [isOpen, direction]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSelect = (val: T) => {
    onChange(val);
    setIsOpen(false);
  };

  const isSmall = size === 'sm';

  return (
    <div
      ref={containerRef}
      className={`relative text-left ${className.includes('w-') ? className : `inline-block ${className}`}`}
    >
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={`w-full flex items-center justify-between gap-2 bg-white border border-[var(--color-border-subtle)] hover:border-slate-400/60 rounded-xl font-semibold text-[var(--color-text-dark)] shadow-xs transition-all duration-150 cursor-pointer disabled:opacity-55 disabled:bg-[var(--color-surface-slate-100)] disabled:cursor-not-allowed disabled:shadow-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] ${
          isSmall ? 'py-1.5 px-3 text-xs' : 'py-2 px-3 text-xs'
        } ${isOpen ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20 shadow-sm' : ''} ${buttonClassName}`}
      >
        <div className="flex items-center gap-2 truncate">
          {icon && <span className="text-[var(--color-primary)] shrink-0">{icon}</span>}
          {labelPrefix && (
            <span className="text-[var(--color-text-muted)] font-medium shrink-0">{labelPrefix}</span>
          )}
          <span className="truncate font-semibold">{selectedOption?.label}</span>
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-[var(--color-primary)]' : ''
          }`}
        />
      </button>

      {/* Floating Menu Card */}
      {isOpen && (
        <div
          className={`absolute ${
            computedDirection === 'up'
              ? 'bottom-full mb-1.5 origin-bottom'
              : 'top-full mt-1.5 origin-top'
          } min-w-full w-max max-w-xs sm:max-w-sm bg-white rounded-xl shadow-xl shadow-slate-900/15 border border-slate-200/90 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 ${
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
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/90 text-[var(--color-primary-dark)] font-bold'
                      : 'text-[var(--color-text-dark)] hover:bg-slate-100/80'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {opt.icon && <span className="text-base shrink-0">{opt.icon}</span>}
                    <div className="truncate">
                      <div className="truncate">{opt.label}</div>
                      {opt.description && (
                        <div className="text-[10px] text-[var(--color-text-muted)] font-normal truncate">
                          {opt.description}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {opt.badge && (
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold border border-slate-200/60">
                        {opt.badge}
                      </span>
                    )}
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-[var(--color-primary)] shrink-0 stroke-[2.5]" />
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
