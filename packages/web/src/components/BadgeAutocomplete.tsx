import { useState, useRef, useEffect, useCallback } from 'react';
import { VALID_BADGES } from '@card-news/shared';
import styles from './BadgeAutocomplete.module.css';

export interface BadgeAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
}

export default function BadgeAutocomplete({
  value,
  onChange,
  onCommit,
}: BadgeAutocompleteProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = value.trim()
    ? VALID_BADGES.filter((b) =>
        b.toLowerCase().includes(value.trim().toLowerCase()),
      )
    : [...VALID_BADGES];

  const isValid =
    value.trim() === '' ||
    VALID_BADGES.some(
      (b) => b.toLowerCase() === value.trim().toLowerCase(),
    );

  const selectBadge = useCallback(
    (badge: string) => {
      onChange(badge);
      setShowDropdown(false);
      setActiveIndex(-1);
      // 선택 후 즉시 커밋
      setTimeout(() => onCommit(), 0);
    },
    [onChange, onCommit],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showDropdown) {
        if (e.key === 'ArrowDown') {
          setShowDropdown(true);
          setActiveIndex(0);
          e.preventDefault();
          return;
        }
      }

      if (showDropdown && filtered.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setActiveIndex((prev) =>
            prev < filtered.length - 1 ? prev + 1 : 0,
          );
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setActiveIndex((prev) =>
            prev > 0 ? prev - 1 : filtered.length - 1,
          );
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (activeIndex >= 0 && activeIndex < filtered.length) {
            selectBadge(filtered[activeIndex]);
          } else {
            setShowDropdown(false);
            onCommit();
          }
        } else if (e.key === 'Escape') {
          setShowDropdown(false);
          setActiveIndex(-1);
        } else if (e.key === 'Tab') {
          setShowDropdown(false);
          onCommit();
        }
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        setShowDropdown(false);
        onCommit();
      } else if (e.key === 'Escape') {
        setShowDropdown(false);
        onCommit();
      }
    },
    [showDropdown, filtered, activeIndex, selectBadge, onCommit],
  );

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <input
        ref={inputRef}
        className={`${styles.input} ${!isValid ? styles.inputInvalid : ''}`}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowDropdown(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setShowDropdown(true)}
        onKeyDown={handleKeyDown}
        placeholder="뱃지 선택 또는 입력..."
        autoComplete="off"
      />
      {!isValid && value.trim() !== '' && (
        <div className={styles.errorHint}>
          ⚠️ 유효하지 않은 뱃지 이름입니다
        </div>
      )}
      {showDropdown && filtered.length > 0 && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownHeader}>
            {filtered.length === VALID_BADGES.length
              ? '전체 뱃지 목록'
              : `검색 결과 ${filtered.length}개`}
          </div>
          {filtered.map((badge, idx) => (
            <div
              key={badge}
              className={`${styles.dropdownItem} ${idx === activeIndex ? styles.dropdownItemActive : ''}`}
              onClick={() => selectBadge(badge)}
              onMouseEnter={() => setActiveIndex(idx)}
            >
              <span className={styles.badgeIcon}>🏷️</span>
              <span className={styles.badgeName}>{badge}</span>
            </div>
          ))}
        </div>
      )}
      {showDropdown && filtered.length === 0 && value.trim() !== '' && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownEmpty}>
            검색 결과가 없습니다
          </div>
        </div>
      )}
    </div>
  );
}
