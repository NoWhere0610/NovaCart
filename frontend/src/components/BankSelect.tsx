import { useEffect, useRef, useState } from "react";
import { IconSearch, IconChevronDown } from "@tabler/icons-react";
import { VIETNAM_BANKS } from "../data/vietnamBanks";

interface BankSelectProps {
  value: string;
  onChange: (bank: string) => void;
  placeholder?: string;
}

/** Ô chọn ngân hàng dạng combobox: bấm mở danh sách kèm ô tìm kiếm ở đầu để lọc nhanh thay vì kéo tay. */
export default function BankSelect({ value, onChange, placeholder }: BankSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [open]);

  const filtered = VIETNAM_BANKS.filter((b) =>
    b.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900 bg-white text-left"
      >
        <span className={value ? "text-stone-900" : "text-stone-400"}>
          {value || placeholder || "Chọn ngân hàng"}
        </span>
        <IconChevronDown size={16} className="text-stone-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-stone-300 shadow-lg">
          <div className="flex items-center gap-2 border-b border-stone-200 px-3 py-2">
            <IconSearch size={16} className="text-stone-400 shrink-0" />
            <input
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm ngân hàng..."
              className="w-full text-sm outline-none"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto">
            {filtered.map((bank) => (
              <li key={bank}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(bank);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-stone-50 ${
                    bank === value ? "bg-stone-100 font-medium" : ""
                  }`}
                >
                  {bank}
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-stone-400">Không tìm thấy ngân hàng</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
