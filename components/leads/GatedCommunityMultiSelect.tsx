'use client';

import { useState, useRef, useEffect } from 'react';
import { X, ChevronDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface GatedCommunityMultiSelectProps {
  /** Currently selected community names */
  selected: string[];
  /** All known community names from the API */
  options: string[];
  /** Called whenever the selection changes */
  onChange: (selected: string[]) => void;
  isLoading?: boolean;
  disabled?: boolean;
  /** Optional error message */
  error?: string;
}

export function GatedCommunityMultiSelect({
  selected,
  options,
  onChange,
  isLoading = false,
  disabled = false,
  error,
}: GatedCommunityMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [customInput, setCustomInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(
    (opt) =>
      opt.toLowerCase().includes(search.toLowerCase()) &&
      !selected.includes(opt),
  );

  function toggle(name: string) {
    if (selected.includes(name)) {
      onChange(selected.filter((s) => s !== name));
    } else {
      onChange([...selected, name]);
    }
  }

  function remove(name: string) {
    onChange(selected.filter((s) => s !== name));
  }

  function addCustom() {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    if (!selected.includes(trimmed)) {
      onChange([...selected, trimmed]);
    }
    setCustomInput('');
    setShowCustomInput(false);
  }

  return (
    <div ref={containerRef} className="space-y-2">
      {/* Selected tags */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-medium text-amber-800"
            >
              {name}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => remove(name)}
                  className="ml-0.5 rounded hover:bg-amber-100 p-0.5"
                  aria-label={`Remove ${name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Dropdown trigger */}
      <div className="relative">
        <button
          type="button"
          disabled={disabled || isLoading}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            'flex w-full items-center justify-between rounded-md border bg-white px-3 py-2 text-sm shadow-sm transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-1',
            error ? 'border-red-500' : 'border-gray-300 hover:border-gray-400',
            (disabled || isLoading) && 'cursor-not-allowed opacity-50',
          )}
        >
          <span className={selected.length === 0 ? 'text-gray-400' : 'text-gray-700'}>
            {isLoading
              ? 'Loading gated communities…'
              : selected.length === 0
              ? 'Select gated communities'
              : `${selected.length} selected`}
          </span>
          <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', open && 'rotate-180')} />
        </button>

        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
            {/* Search */}
            <div className="p-2 border-b border-gray-100">
              <Input
                autoFocus
                placeholder="Search communities…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            {/* Options list */}
            <ul className="max-h-52 overflow-y-auto py-1">
              {filteredOptions.length === 0 && (
                <li className="px-3 py-2 text-xs text-gray-400">
                  {search ? 'No matches found' : 'No more options'}
                </li>
              )}
              {filteredOptions.map((opt) => (
                <li key={opt}>
                  <button
                    type="button"
                    onClick={() => toggle(opt)}
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-amber-50 hover:text-amber-900 transition-colors"
                  >
                    {opt}
                  </button>
                </li>
              ))}
            </ul>

            {/* Already-selected items (to deselect) */}
            {selected.length > 0 && (
              <>
                <div className="border-t border-gray-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  Selected (click to remove)
                </div>
                <ul className="pb-1">
                  {selected.map((name) => (
                    <li key={name}>
                      <button
                        type="button"
                        onClick={() => toggle(name)}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-amber-700 hover:bg-red-50 hover:text-red-700 transition-colors"
                      >
                        <X className="h-3 w-3 shrink-0" />
                        {name}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {/* Add custom */}
            <div className="border-t border-gray-100 p-2">
              {showCustomInput ? (
                <div className="flex gap-1.5">
                  <Input
                    autoFocus
                    placeholder="Custom community name"
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); addCustom(); }
                      if (e.key === 'Escape') { setShowCustomInput(false); setCustomInput(''); }
                    }}
                    className="h-8 text-sm flex-1"
                  />
                  <Button type="button" size="sm" onClick={addCustom} className="h-8 px-2">
                    Add
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => { setShowCustomInput(false); setCustomInput(''); }}
                    className="h-8 px-2"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCustomInput(true)}
                  className="flex w-full items-center gap-1.5 px-1 py-1 text-xs text-gray-500 hover:text-amber-700 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add custom community
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
