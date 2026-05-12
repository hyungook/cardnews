import { useState, useRef, useEffect, useCallback } from 'react';
import { VALID_BADGES } from '@card-news/shared';
import styles from './BadgeAutocomplete.module.css';

export interface BadgeAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onCommit: (value?: string) => void;
}

export default function BadgeAutocomplete({
  value,
  onChange,
  onCommit,
}: BadgeAutocompleteProps) {
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filtered = searchQuery.trim()
    ? VALID_BADGES.filter((b) =>
        b.toLowerCase().includes(searchQuery.trim().toLowerCase()),
      )
    : [...VALID_BADGES];

  const isValid =
    value.trim() === '' ||
    VALID_BADGES.some(
      (b) => b.toLowerCase() === value.trim().toLowerCase(),
    );

  const selectBadge = useCallback(
    (badge: string) => {
      console.log('[BadgeAutocomplete] selectBadge 호출됨', { badge, currentValue: value });
      onChange(badge);
      setShowModal(false);
      setSearchQuery('');
      setActiveIndex(-1);
      // 선택한 값을 직접 onCommit에 전달
      console.log('[BadgeAutocomplete] onCommit 호출 (값 전달:', badge, ')');
      setTimeout(() => {
        onCommit(badge);
      }, 10);
    },
    [onChange, onCommit, value],
  );

  const handleOpenModal = useCallback(() => {
    setShowModal(true);
    setSearchQuery('');
    setActiveIndex(-1);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    setSearchQuery('');
    setActiveIndex(-1);
  }, []);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleCloseModal();
    }
  }, [handleCloseModal]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseModal();
      } else if (e.key === 'Enter') {
        if (activeIndex >= 0 && activeIndex < filtered.length) {
          e.preventDefault();
          selectBadge(filtered[activeIndex]);
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) =>
          prev < filtered.length - 1 ? prev + 1 : 0,
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) =>
          prev > 0 ? prev - 1 : filtered.length - 1,
        );
      }
    },
    [filtered, activeIndex, selectBadge, handleCloseModal],
  );

  // Focus search input when modal opens
  useEffect(() => {
    if (showModal && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showModal]);

  return (
    <>
      <div className={styles.wrapper}>
        <input
          ref={inputRef}
          className={`${styles.input} ${!isValid ? styles.inputInvalid : ''}`}
          type="text"
          value={value}
          onClick={handleOpenModal}
          readOnly
          placeholder="뱃지 선택..."
          autoComplete="off"
        />
        {!isValid && value.trim() !== '' && (
          <div className={styles.errorHint}>
            ⚠️ 유효하지 않은 뱃지 이름입니다
          </div>
        )}
      </div>

      {showModal && (
        <div className={styles.backdrop} onClick={handleBackdropClick}>
          <div className={styles.modal}>
            <div className={styles.header}>
              <h2 className={styles.title}>🏷️ 뱃지 선택</h2>
              <button className={styles.closeBtn} onClick={handleCloseModal}>
                ✕
              </button>
            </div>

            <div className={styles.searchSection}>
              <input
                ref={searchInputRef}
                className={styles.searchInput}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setActiveIndex(-1);
                }}
                onKeyDown={handleKeyDown}
                placeholder="뱃지 검색..."
                autoComplete="off"
              />
            </div>

            <div className={styles.content}>
              {filtered.length === 0 ? (
                <div className={styles.empty}>
                  <div className={styles.emptyIcon}>🔍</div>
                  <div className={styles.emptyText}>검색 결과가 없습니다</div>
                </div>
              ) : (
                <>
                  <div className={styles.resultHeader}>
                    {filtered.length === VALID_BADGES.length
                      ? `전체 뱃지 ${VALID_BADGES.length}개`
                      : `검색 결과 ${filtered.length}개`}
                  </div>
                  <div className={styles.badgeGrid}>
                    {/* 선택 안 함 옵션 */}
                    <div
                      className={`${styles.badgeCard} ${value === '' ? styles.selected : ''}`}
                      onClick={() => selectBadge('')}
                      onMouseEnter={() => setActiveIndex(-1)}
                    >
                      <div className={styles.badgeIcon}>🚫</div>
                      <div className={styles.badgeName}>선택 안 함</div>
                    </div>

                    {/* 뱃지 목록 */}
                    {filtered.map((badge, idx) => (
                      <div
                        key={badge}
                        className={`${styles.badgeCard} ${value === badge ? styles.selected : ''} ${idx === activeIndex ? styles.active : ''}`}
                        onClick={() => selectBadge(badge)}
                        onMouseEnter={() => setActiveIndex(idx)}
                      >
                        <div className={styles.badgeIcon}>🏷️</div>
                        <div className={styles.badgeName}>{badge}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className={styles.footer}>
              <button className={styles.cancelBtn} onClick={handleCloseModal}>
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
