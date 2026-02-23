import { Check, ChevronDown } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

export interface SelectOption {
    value: string;
    label: string;
    icon?: ReactNode;
}

interface CustomSelectProps {
    value: string;
    options: SelectOption[];
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

export default function CustomSelect({
    value,
    options,
    onChange,
    placeholder = '请选择',
    className,
}: CustomSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const selectedOption = options.find(o => o.value === value);

    const handleSelect = useCallback((optionValue: string) => {
        onChange(optionValue);
        setIsOpen(false);
    }, [onChange]);

    return (
        <div ref={containerRef} className={`relative inline-block ${className ?? ''}`}>
            {/* Trigger */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--paper)] px-3 py-1.5 text-[13px] font-medium text-[var(--ink)] transition-colors hover:bg-[var(--hover)] ${
                    isOpen ? 'border-[var(--accent)]' : ''
                }`}
            >
                <span className={selectedOption ? 'text-[var(--ink)]' : 'text-[var(--ink-tertiary)]'}>
                    {selectedOption?.label ?? placeholder}
                </span>
                <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-[var(--ink-tertiary)] transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 top-full z-50 mt-1 min-w-full overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--paper)] py-1 shadow-lg">
                    {options.map(option => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => handleSelect(option.value)}
                            className={`flex w-full items-center gap-2 whitespace-nowrap px-3 py-1.5 text-left text-[13px] transition-colors ${
                                option.value === value
                                    ? 'font-medium text-[var(--accent)]'
                                    : 'text-[var(--ink)] hover:bg-[var(--hover)]'
                            }`}
                        >
                            {option.icon && <span className="shrink-0">{option.icon}</span>}
                            <span className="flex-1">{option.label}</span>
                            {option.value === value && (
                                <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
