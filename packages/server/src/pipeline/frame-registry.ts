/**
 * 프레임 레지스트리: 배치별 복제 프레임 ID를 추적하는 인메모리 저장소.
 * 파이프라인이 프레임을 복제할 때 등록하고,
 * 프레임 정리 시 배치 단위로 삭제할 수 있다.
 */

export interface BatchEntry {
  batchId: string;
  frameIds: string[];
  createdAt: string; // ISO 8601
}

class FrameRegistry {
  private batches = new Map<string, BatchEntry>();

  /** 새 배치를 등록한다. */
  registerBatch(batchId: string): void {
    if (!this.batches.has(batchId)) {
      this.batches.set(batchId, {
        batchId,
        frameIds: [],
        createdAt: new Date().toISOString(),
      });
    }
  }

  /** 배치에 프레임 ID를 추가한다. */
  addFrame(batchId: string, frameId: string): void {
    const entry = this.batches.get(batchId);
    if (entry) {
      entry.frameIds.push(frameId);
    }
  }

  /** 특정 배치의 정보를 반환한다. */
  getBatch(batchId: string): BatchEntry | undefined {
    return this.batches.get(batchId);
  }

  /** 모든 배치 목록을 반환한다. */
  getAllBatches(): BatchEntry[] {
    return Array.from(this.batches.values());
  }

  /** 배치를 레지스트리에서 제거한다. */
  removeBatch(batchId: string): boolean {
    return this.batches.delete(batchId);
  }

  /** 레지스트리를 초기화한다 (테스트용). */
  clear(): void {
    this.batches.clear();
  }
}

/** 싱글턴 인스턴스 */
export const frameRegistry = new FrameRegistry();
