import { useState, useEffect } from 'react';
import { VALID_BADGES } from '@card-news/shared';
import styles from './GuidePanel.module.css';

const GUIDE_SEEN_KEY = 'cardnews_guide_seen';

export default function GuidePanel() {
  const [open, setOpen] = useState(false);

  // 첫 방문 시 자동 표시
  useEffect(() => {
    const seen = localStorage.getItem(GUIDE_SEEN_KEY);
    if (!seen) {
      setOpen(true);
      localStorage.setItem(GUIDE_SEEN_KEY, 'true');
    }
  }, []);

  return (
    <>
      {/* 플로팅 버튼 */}
      <button
        className={styles.fab}
        onClick={() => setOpen(true)}
        title="제작 가이드 열기"
        aria-label="제작 가이드 열기"
        style={{
          borderRadius: '50%',
          width: '60px',
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '32px',
          fontWeight: '700',
        }}
      >
        ?
      </button>

      {/* 오버레이 */}
      {open && <div className={styles.overlay} onClick={() => setOpen(false)} />}

      {/* 슬라이드 패널 */}
      <div className={`${styles.panel} ${open ? styles.panelOpen : ''}`}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>📖 카드뉴스 제작 가이드</h2>
          <button
            className={styles.closeBtn}
            onClick={() => setOpen(false)}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className={styles.panelBody}>
          {/* 1. 준비물 */}
          <Section title="1. 준비물 체크리스트" emoji="✅">
            <CheckItem label="배경 이미지" desc="영화제목.jpg 형식으로 로컬에서 직접 업로드" example="범죄도시4.jpg" />
            <CheckItem label="로고 이미지" desc="LI_영화제목.png 형식으로 로컬에서 직접 업로드" example="LI_범죄도시4.png" />
            <CheckItem label="기본문구" desc="영화/드라마를 홍보하는 짧은 문장 (1~3줄)" example="올 여름&#10;최고의 블록버스터" />
            <CheckItem label="추가문구 (선택)" desc="수상내역 등 추가 정보. 없으면 비워두세요" example="칸 영화제 수상작" />
            <CheckItem label="뱃지 (선택)" desc="아래 20종 중 최대 4개 선택. 없으면 비워두세요" />
            <CheckItem label="카피라이트 (선택)" desc="저작권 표기. 없으면 비워두세요" example="© 2024 배급사" />
          </Section>

          {/* 2. 스프레드시트 작성법 */}
          <Section title="2. 스프레드시트 작성법" emoji="📊">
            <div className={styles.tipBox}>
              <p><strong>한 행 = 카드뉴스 1장</strong></p>
              <p>영화제목만 입력하면 배경/로고 파일은 자동으로 찾아요!</p>
            </div>

            <h4 className={styles.subTitle}>컬럼 구조</h4>
            <div className={styles.tableScroll}>
              <table className={styles.guideTable}>
                <thead>
                  <tr>
                    <th>A</th><th>B</th><th>C</th><th>D~G</th><th>H</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>영화제목</td><td>기본문구</td><td>추가문구</td><td>뱃지1~4</td><td>카피라이트</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h4 className={styles.subTitle}>줄바꿈 입력 방법</h4>
            <ul className={styles.tipList}>
              <li>구글 시트에서: <kbd>Ctrl</kbd> + <kbd>Enter</kbd> (Mac: <kbd>⌘</kbd> + <kbd>Enter</kbd>)</li>
              <li>웹 UI에서: <kbd>Shift</kbd> + <kbd>Enter</kbd></li>
            </ul>

            <h4 className={styles.subTitle}>파일명이 규칙과 다른 경우</h4>
            <p className={styles.tipText}>
              I열(배경파일명)과 J열(로고파일명)에 직접 입력하면 자동 생성 대신 그 파일명을 사용합니다.
            </p>
          </Section>

          {/* 3. 파일명 규칙 */}
          <Section title="3. 이미지 파일 업로드" emoji="📁">
            <div className={styles.ruleBox}>
              <div className={styles.ruleRow}>
                <span className={styles.ruleLabel}>배경 이미지</span>
                <code className={styles.ruleCode}>{'{영화제목}.jpg'}</code>
              </div>
              <div className={styles.ruleExample}>예: 범죄도시4.jpg, 인사이드아웃.jpg</div>

              <div className={styles.ruleRow}>
                <span className={styles.ruleLabel}>로고 이미지</span>
                <code className={styles.ruleCode}>{'LI_{영화제목}.png'}</code>
              </div>
              <div className={styles.ruleExample}>예: LI_범죄도시4.png, LI_인사이드아웃.png</div>
            </div>

            <h4 className={styles.subTitle}>이미지 업로드 방법</h4>
            <ol className={styles.numberedList}>
              <li>대시보드 하단의 <strong>"이미지 업로드"</strong> 섹션을 찾습니다.</li>
              <li><strong>"배경이미지"</strong> 또는 <strong>"로고"</strong> 버튼을 클릭하여 폴더를 선택합니다.</li>
              <li>파일을 드래그 앤 드롭하거나 클릭하여 선택합니다.</li>
              <li>업로드된 파일 목록에서 확인할 수 있습니다.</li>
            </ol>

            <p className={styles.tipText}>
              💡 파일명이 규칙과 다른 경우, 스프레드시트의 I열(배경파일명)과 J열(로고파일명)에 직접 입력하세요.
            </p>
          </Section>

          {/* 4. 뱃지 목록 */}
          <Section title="4. 뱃지 목록 (20종)" emoji="🏷️">
            <div className={styles.badgeGrid}>
              {VALID_BADGES.map((badge) => (
                <span key={badge} className={styles.badgeChip}>{badge}</span>
              ))}
            </div>
            <p className={styles.tipText}>
              뱃지 이름은 정확히 입력해야 합니다. 웹 UI에서는 자동완성이 지원돼요.
              <br />대소문자는 자동으로 맞춰주니 걱정하지 마세요.
            </p>
          </Section>

          {/* 5. Figma 플러그인 실행 */}
          <Section title="5. Figma 플러그인 실행 (필수)" emoji="🔌">
            <div className={styles.tipBox} style={{ background: '#3a2a0c', color: '#fbbf24', border: '1px solid #f59e0b' }}>
              <p style={{ color: '#fef3c7' }}><strong>⚠️ 카드뉴스를 생성하려면 Figma 플러그인이 실행 중이어야 합니다!</strong></p>
              <p style={{ color: '#fde68a' }}>아래 순서대로 한 번만 설정하면, 이후에는 Figma에서 플러그인만 실행하면 돼요.</p>
            </div>

            <h4 className={styles.subTitle}>최초 1회: 플러그인 등록</h4>
            <ol className={styles.numberedList}>
              <li><strong>Figma 데스크톱 앱</strong>을 엽니다. (웹 버전 아님!)</li>
              <li>카드뉴스 템플릿이 있는 <strong>Figma 파일</strong>을 엽니다.</li>
              <li>상단 메뉴에서 <strong>Plugins</strong> → <strong>Development</strong> → <strong>Import plugin from manifest...</strong> 를 클릭합니다.</li>
              <li>파일 선택 창에서 아래 경로의 파일을 선택합니다:</li>
            </ol>
            <pre className={styles.folderTree}>{`/Users/ohhyungook/KIRO/packages/figma-plugin/manifest.json`}</pre>
            <p className={styles.tipText}>
              💡 Finder에서 <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>G</kbd> 를 누르고 위 경로를 붙여넣으면 빠르게 찾을 수 있어요.
            </p>

            <h4 className={styles.subTitle}>매번 사용 시: 플러그인 실행</h4>
            <ol className={styles.numberedList}>
              <li>Figma에서 카드뉴스 템플릿 파일을 엽니다.</li>
              <li>상단 메뉴 <strong>Plugins</strong> → <strong>Development</strong> → <strong>카드뉴스 자동화</strong> 를 클릭합니다.</li>
              <li>플러그인이 실행되면 화면에 변화는 없지만, 백그라운드에서 서버와 연결됩니다.</li>
              <li>웹 UI 대시보드에서 "생성" 버튼이 활성화되면 연결 성공!</li>
            </ol>

            <FaqItem
              q="'Figma 플러그인이 연결되어 있지 않습니다' 에러가 나와요"
              a="Figma 데스크톱 앱에서 플러그인을 실행했는지 확인하세요. 플러그인을 다시 실행하면 자동으로 재연결됩니다."
            />
            <FaqItem
              q="플러그인 목록에 '카드뉴스 자동화'가 안 보여요"
              a="위의 '최초 1회: 플러그인 등록' 과정을 다시 진행해주세요."
            />
          </Section>

          {/* 6. 카드뉴스 생성 순서 */}
          <Section title="6. 카드뉴스 생성 순서" emoji="🚀">
            <ol className={styles.stepList}>
              <li>
                <strong>이미지 업로드</strong>
                <p>대시보드 하단의 "이미지 업로드" 섹션에서 배경 이미지와 로고를 업로드합니다.</p>
              </li>
              <li>
                <strong>스프레드시트 작성</strong>
                <p>영화제목, 문구, 뱃지, 카피라이트를 입력합니다.</p>
              </li>
              <li>
                <strong>행 선택</strong>
                <p>대시보드에서 생성할 행의 체크박스를 선택합니다.</p>
              </li>
              <li>
                <strong>미리보기 (선택)</strong>
                <p>👁 버튼으로 미리보기를 확인할 수 있어요. (저해상도)</p>
              </li>
              <li>
                <strong>"생성" 버튼 클릭</strong>
                <p>선택한 행의 카드뉴스가 자동으로 생성됩니다.</p>
              </li>
              <li>
                <strong>결과 확인 및 다운로드</strong>
                <p>성공/실패 결과를 확인하고 생성된 카드뉴스를 다운로드합니다.</p>
              </li>
            </ol>
          </Section>

          {/* 7. 자주 하는 실수 */}
          <Section title="7. 자주 하는 실수 & 해결법" emoji="⚠️">
            <div className={styles.faqList}>
              <FaqItem
                q="파일을 찾을 수 없다고 나와요"
                a="이미지 업로드 섹션에서 파일을 업로드했는지, 파일명이 영화제목과 정확히 일치하는지 확인하세요. 파일명이 다르면 I, J열에 직접 입력하세요."
              />
              <FaqItem
                q="뱃지 이름이 유효하지 않다고 나와요"
                a="뱃지 이름에 오타가 없는지 확인하세요. 위 20종 목록에 있는 이름만 사용할 수 있어요."
              />
              <FaqItem
                q="기본문구가 3줄을 초과한다고 나와요"
                a="기본문구는 최대 3줄까지만 가능해요. 줄바꿈을 줄이거나 문구를 짧게 수정하세요."
              />
              <FaqItem
                q="텍스트가 영역을 초과한다고 나와요"
                a="문구가 Figma 템플릿의 텍스트 영역보다 길어요. 문구를 줄여주세요."
              />
              <FaqItem
                q="용량이 500KB를 초과한다는 경고가 나와요"
                a="권장 기준이라 생성은 완료됩니다. 배경 이미지가 너무 복잡하면 발생할 수 있어요."
              />
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}

/* ── Sub-components ── */

function Section({ title, emoji, children }: { title: string; emoji: string; children: React.ReactNode }) {
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>{emoji} {title}</h3>
      {children}
    </section>
  );
}

function CheckItem({ label, desc, example }: { label: string; desc: string; example?: string }) {
  return (
    <div className={styles.checkItem}>
      <div className={styles.checkLabel}>☑️ {label}</div>
      <div className={styles.checkDesc}>{desc}</div>
      {example && <div className={styles.checkExample}>예: <code>{example}</code></div>}
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <div className={styles.faqItem}>
      <div className={styles.faqQ}>Q. {q}</div>
      <div className={styles.faqA}>→ {a}</div>
    </div>
  );
}
