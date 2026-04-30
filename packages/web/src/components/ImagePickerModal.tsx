import { useState, useEffect } from 'react';
import styles from './ImagePickerModal.module.css';

interface ImagePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (filename: string) => void;
  files: { filename: string; folder: string }[];
  folder: '배경이미지' | '로고';
  currentValue: string;
}

export default function ImagePickerModal({
  isOpen,
  onClose,
  onSelect,
  files,
  folder,
  currentValue,
}: ImagePickerModalProps) {
  const [selectedFile, setSelectedFile] = useState<string>(currentValue);

  useEffect(() => {
    setSelectedFile(currentValue);
  }, [currentValue, isOpen]);

  if (!isOpen) return null;

  const filteredFiles = files.filter((f) => f.folder === folder);

  const handleSelect = () => {
    onSelect(selectedFile);
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            {folder === '배경이미지' ? '🖼️ 배경 이미지 선택' : '🏷️ 로고 선택'}
          </h2>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.content}>
          {filteredFiles.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>📁</div>
              <div className={styles.emptyText}>
                업로드된 {folder === '배경이미지' ? '배경 이미지' : '로고'}가 없습니다
              </div>
              <div className={styles.emptyHint}>
                이미지 업로드 섹션에서 파일을 업로드해주세요
              </div>
            </div>
          ) : (
            <div className={styles.grid}>
              {/* 선택 안 함 옵션 */}
              <div
                className={`${styles.card} ${selectedFile === '' ? styles.selected : ''}`}
                onClick={() => setSelectedFile('')}
              >
                <div className={styles.noImagePreview}>
                  <div className={styles.noImageIcon}>🚫</div>
                  <div className={styles.noImageText}>선택 안 함</div>
                </div>
                <div className={styles.cardFooter}>
                  <div className={styles.filename}>자동 매칭</div>
                </div>
              </div>

              {/* 파일 목록 */}
              {filteredFiles.map((file) => (
                <div
                  key={file.filename}
                  className={`${styles.card} ${selectedFile === file.filename ? styles.selected : ''}`}
                  onClick={() => setSelectedFile(file.filename)}
                >
                  <div className={styles.imagePreview}>
                    <img
                      src={`/api/local/files/${encodeURIComponent(file.filename)}?folder=${encodeURIComponent(file.folder)}`}
                      alt={file.filename}
                      className={styles.image}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          parent.innerHTML = '<div class="' + styles.imageError + '">❌<br/>로드 실패</div>';
                        }
                      }}
                    />
                  </div>
                  <div className={styles.cardFooter}>
                    <div className={styles.filename} title={file.filename}>
                      {file.filename}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>
            취소
          </button>
          <button
            className={styles.selectBtn}
            onClick={handleSelect}
            disabled={filteredFiles.length === 0}
          >
            선택
          </button>
        </div>
      </div>
    </div>
  );
}
