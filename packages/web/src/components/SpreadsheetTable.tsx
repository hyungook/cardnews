import { useState, useCallback, useRef, useEffect } from 'react';
import type { CardNewsRow } from '@card-news/shared';
import { apiFetch } from '../api/client';
import BadgeAutocomplete from './BadgeAutocomplete';
import ImagePickerModal from './ImagePickerModal';
import styles from './SpreadsheetTable.module.css';

/** Column definitions for the spreadsheet table */
const COLUMNS: { key: keyof CardNewsRow; label: string; multiLine?: boolean }[] = [
  { key: 'movieTitle', label: '영화제목' },
  { key: 'backgroundFilenameOverride', label: '배경이미지' },
  { key: 'logoFilenameOverride', label: '로고' },
  { key: 'mainText', label: '기본문구', multiLine: true },
  { key: 'subText', label: '추가문구', multiLine: true },
  { key: 'badge1', label: '뱃지1' },
  { key: 'badge2', label: '뱃지2' },
  { key: 'badge3', label: '뱃지3' },
  { key: 'badge4', label: '뱃지4' },
  { key: 'copyright', label: '카피라이트' },
];

/**
 * Map CardNewsRow field key to the spreadsheet column index (0-based).
 * 컬럼 순서: 영화제목(0), 배경이미지(1), 로고(2), 기본문구(3), 추가문구(4), 뱃지1(5), 뱃지2(6), 뱃지3(7), 뱃지4(8), 카피라이트(9)
 */
const FIELD_TO_COL: Record<string, number> = {
  movieTitle: 0,
  backgroundFilenameOverride: 1,
  logoFilenameOverride: 2,
  mainText: 3,
  subText: 4,
  badge1: 5,
  badge2: 6,
  badge3: 7,
  badge4: 8,
  copyright: 9,
};

const BADGE_FIELDS = new Set<string>(['badge1', 'badge2', 'badge3', 'badge4']);
const IMAGE_FIELDS = new Set<string>(['backgroundFilenameOverride', 'logoFilenameOverride']);

export interface SpreadsheetTableProps {
  rows: CardNewsRow[];
  onRefresh: () => void;
  onRowsSelected: (selectedRows: number[]) => void;
  selectedRows: number[];
  onPreviewRow?: (rowIndex: number) => void;
  uploadedFiles: { filename: string; folder: string }[];
  onFilesChange: () => void;
}

interface EditingCell {
  rowIndex: number;
  field: keyof CardNewsRow;
}

export default function SpreadsheetTable({
  rows,
  onRefresh,
  onRowsSelected,
  selectedRows,
  onPreviewRow,
  uploadedFiles,
  onFilesChange,
}: SpreadsheetTableProps) {
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [imagePickerField, setImagePickerField] = useState<'backgroundFilenameOverride' | 'logoFilenameOverride' | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);

  // Focus the input/textarea when entering edit mode
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  const handleCellClick = useCallback(
    (rowIndex: number, field: keyof CardNewsRow) => {
      if (field === 'rowIndex') return;
      const row = rows.find((r) => r.rowIndex === rowIndex);
      if (!row) return;
      
      // 이미지 필드는 모달로 처리
      if (IMAGE_FIELDS.has(field)) {
        setEditing({ rowIndex, field });
        setEditValue(String(row[field] || ''));
        setImagePickerField(field as 'backgroundFilenameOverride' | 'logoFilenameOverride');
        setImagePickerOpen(true);
        return;
      }
      
      setEditing({ rowIndex, field });
      setEditValue(String(row[field]));
    },
    [rows],
  );

  const commitEdit = useCallback(async () => {
    if (!editing) return;
    const row = rows.find((r) => r.rowIndex === editing.rowIndex);
    if (!row) {
      setEditing(null);
      return;
    }

    const oldValue = String(row[editing.field] || '');
    if (editValue === oldValue) {
      setEditing(null);
      return;
    }

    const col = FIELD_TO_COL[editing.field];
    if (col === undefined) {
      setEditing(null);
      return;
    }

    try {
      await apiFetch('/sheets/cell', {
        method: 'PUT',
        body: JSON.stringify({ row: editing.rowIndex, col, value: editValue }),
      });
      // Update local state optimistically — parent will get fresh data on refresh
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (row as any)[editing.field] = editValue;
    } catch {
      // Silently fail — user can retry or refresh
    }
    setEditing(null);
  }, [editing, editValue, rows]);

  const handleImageSelect = useCallback(async (filename: string) => {
    setEditValue(filename);
    // 모달이 닫힌 후 커밋
    setTimeout(async () => {
      if (!editing) return;
      const row = rows.find((r) => r.rowIndex === editing.rowIndex);
      if (!row) return;

      const col = FIELD_TO_COL[editing.field];
      if (col === undefined) return;

      try {
        await apiFetch('/sheets/cell', {
          method: 'PUT',
          body: JSON.stringify({ row: editing.rowIndex, col, value: filename }),
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (row as any)[editing.field] = filename;
      } catch {
        // Silently fail
      }
      setEditing(null);
    }, 0);
  }, [editing, rows]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, multiLine: boolean) => {
      if (multiLine) {
        // Shift+Enter inserts line break (default textarea behavior)
        // Enter alone commits the edit
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          commitEdit();
        }
      } else {
        if (e.key === 'Enter') {
          e.preventDefault();
          commitEdit();
        }
      }
      if (e.key === 'Escape') {
        setEditing(null);
      }
    },
    [commitEdit],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      onRefresh();
    } finally {
      // Small delay so the spinner is visible
      setTimeout(() => setRefreshing(false), 300);
    }
  }, [onRefresh]);

  // Selection handlers
  const allSelected = rows.length > 0 && selectedRows.length === rows.length;
  const someSelected = selectedRows.length > 0 && selectedRows.length < rows.length;

  const toggleAll = useCallback(() => {
    if (allSelected) {
      onRowsSelected([]);
    } else {
      onRowsSelected(rows.map((r) => r.rowIndex));
    }
  }, [allSelected, rows, onRowsSelected]);

  const toggleRow = useCallback(
    (rowIndex: number) => {
      if (selectedRows.includes(rowIndex)) {
        onRowsSelected(selectedRows.filter((i) => i !== rowIndex));
      } else {
        onRowsSelected([...selectedRows, rowIndex]);
      }
    },
    [selectedRows, onRowsSelected],
  );

  return (
    <div>
      <div className={styles.toolbar}>
        <button
          className={styles.refreshBtn}
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? '⏳' : '🔄'} 새로고침
        </button>
        {rows.length > 0 && (
          <span className={styles.info}>
            {rows.length}행 · {selectedRows.length}개 선택됨
          </span>
        )}
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.checkboxCell}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={toggleAll}
                  aria-label="전체 선택"
                />
              </th>
              <th className={styles.rowIndexCell}>행번호</th>
              <th style={{ width: 60 }}>미리보기</th>
              {COLUMNS.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isSelected = selectedRows.includes(row.rowIndex);
              return (
                <tr
                  key={row.rowIndex}
                  className={isSelected ? styles.selectedRow : undefined}
                >
                  <td className={styles.checkboxCell}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleRow(row.rowIndex)}
                      aria-label={`${row.rowIndex}행 선택`}
                    />
                  </td>
                  <td className={styles.rowIndexCell}>{row.rowIndex}</td>
                  <td style={{ textAlign: 'center' }}>
                    {onPreviewRow && (
                      <button
                        onClick={() => onPreviewRow(row.rowIndex)}
                        style={{
                          padding: '2px 8px',
                          border: '1px solid #ddd',
                          borderRadius: 4,
                          background: '#fff',
                          fontSize: 11,
                          cursor: 'pointer',
                        }}
                        title="미리보기"
                      >
                        👁
                      </button>
                    )}
                  </td>
                  {COLUMNS.map((col) => {
                    const isEditing =
                      editing?.rowIndex === row.rowIndex &&
                      editing?.field === col.key;
                    const value = String(row[col.key] || '');
                    const isBadgeCol = BADGE_FIELDS.has(col.key);
                    const isImageCol = IMAGE_FIELDS.has(col.key);

                    // 이미지 필드는 모달로 처리하므로 편집 모드 없음
                    if (isImageCol) {
                      return (
                        <td
                          key={col.key}
                          className={styles.cell}
                          onClick={() => handleCellClick(row.rowIndex, col.key)}
                          style={{ cursor: 'pointer' }}
                        >
                          {value ? (
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '6px',
                              fontSize: '11px',
                            }}>
                              <span>📎</span>
                              <span style={{ 
                                flex: 1, 
                                overflow: 'hidden', 
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}>
                                {value}
                              </span>
                            </div>
                          ) : (
                            <button
                              style={{
                                padding: '4px 10px',
                                fontSize: '11px',
                                border: '1px solid #ddd',
                                borderRadius: 4,
                                background: '#f8f9fa',
                                cursor: 'pointer',
                                color: '#666',
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCellClick(row.rowIndex, col.key);
                              }}
                            >
                              🖼️ 선택
                            </button>
                          )}
                        </td>
                      );
                    }

                    if (isEditing) {
                      return (
                        <td key={col.key} className={styles.cellEditing}>
                          {isBadgeCol ? (
                            <BadgeAutocomplete
                              value={editValue}
                              onChange={setEditValue}
                              onCommit={commitEdit}
                            />
                          ) : col.multiLine ? (
                            <textarea
                              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                              className={styles.cellTextarea}
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={commitEdit}
                              onKeyDown={(e) => handleKeyDown(e, true)}
                            />
                          ) : (
                            <input
                              ref={inputRef as React.RefObject<HTMLInputElement>}
                              className={styles.cellInput}
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={commitEdit}
                              onKeyDown={(e) => handleKeyDown(e, false)}
                            />
                          )}
                        </td>
                      );
                    }

                    return (
                      <td
                        key={col.key}
                        className={styles.cell}
                        onClick={() => handleCellClick(row.rowIndex, col.key)}
                      >
                        {value || (
                          <span className={styles.emptyCell}>—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={COLUMNS.length + 3}
                  style={{ textAlign: 'center', padding: '32px', color: '#999' }}
                >
                  데이터가 없습니다. 새로고침을 눌러주세요.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 이미지 선택 모달 */}
      {imagePickerField && (
        <ImagePickerModal
          isOpen={imagePickerOpen}
          onClose={() => {
            setImagePickerOpen(false);
            setEditing(null);
          }}
          onSelect={handleImageSelect}
          files={uploadedFiles}
          folder={imagePickerField === 'backgroundFilenameOverride' ? '배경이미지' : '로고'}
          currentValue={editValue}
        />
      )}
    </div>
  );
}
