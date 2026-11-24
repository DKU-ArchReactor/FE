import React from "react";
import type { SectionConfig, PanelKey } from "../types";

interface SlidingViewportTrackProps {
  sections: SectionConfig[];
  rightViewportIndex: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  renderPanel: (panel: PanelKey) => React.ReactNode;
  resizingPair: { secIdx: number; slotIdx: number } | null;
  resizingRowSlot: { secIdx: number; slotIdx: number } | null;
  onPairResizeStart: (secIdx: number, slotIdx: number, initialPairRatio: number, e: React.MouseEvent) => void;
  onSlotResizeStart: (secIdx: number, slotIdx: number, topRatio: number, btmRatio: number, e: React.MouseEvent) => void;
  onPairReset?: (secIdx: number, slotIdx: number) => void;
  onSlotReset?: (secIdx: number, slotIdx: number) => void;
  mobileLeadSection?: React.ReactNode;
  mobileExtraSection?: React.ReactNode;
  mobileViewportIndex?: number;
}

export const SlidingViewportTrack: React.FC<SlidingViewportTrackProps> = ({
  sections,
  rightViewportIndex,
  containerRef,
  renderPanel,
  resizingPair,
  resizingRowSlot,
  onPairResizeStart,
  onSlotResizeStart,
  onPairReset,
  onSlotReset,
  mobileLeadSection,
  mobileExtraSection,
  mobileViewportIndex,
}) => {
  const effectiveMobileIndex = mobileViewportIndex ?? rightViewportIndex;

  return (
    <div ref={containerRef} className="flex-1 h-full min-w-0 overflow-hidden relative">
      <div
        className="flex h-full w-full transition-transform duration-500 ease-in-out translate-x-[var(--mobile-tx)] md:translate-x-[var(--desktop-tx)]"
        style={
          {
            "--mobile-tx": `-${effectiveMobileIndex * 100}%`,
            "--desktop-tx": `-${rightViewportIndex * 100}%`,
          } as React.CSSProperties
        }
      >
        {mobileLeadSection && (
          <div className="flex md:hidden h-full min-h-0 shrink-0 w-full overflow-hidden flex-col gap-1.5">
            {mobileLeadSection}
          </div>
        )}

        {sections.map((section, secIdx) => {
          return (
            <div
              key={section.id}
              className="flex h-full min-h-0 shrink-0 w-full overflow-hidden"
            >
              {/* 구역 내부 세로 슬롯 렌더링 */}
              <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                {section.slots.map((slot, slotIdx) => {
                  const isMetricsFixed =
                    section.id === "sec-5" &&
                    slot.type === "single" &&
                    slot.panel === "metrics";

                  const isTimingDiagram =
                    section.id === "sec-5" &&
                    slot.type === "single" &&
                    slot.panel === "multiCycle";

                  const defaultRatio =
                    section.slots.length === 2 &&
                    slot.type === "single" &&
                    slot.panel === "pipeline"
                      ? 1.9
                      : 1;
                  const flexVal = slot.flexRatio ?? defaultRatio;

                  return (
                    <React.Fragment key={slotIdx}>
                      <div
                        className={
                          isMetricsFixed
                            ? "shrink min-h-0 flex flex-col w-full overflow-hidden"
                            : isTimingDiagram
                            ? "min-h-0 overflow-hidden flex flex-col"
                            : "min-h-0 overflow-hidden flex"
                        }
                        style={
                          isMetricsFixed
                            ? { flex: "0 1 auto", maxHeight: "min(60%, calc(100% - 40vh))" }
                            : isTimingDiagram
                            ? { flex: `${flexVal} 1 0%`, minHeight: "max(40%, 40vh)" }
                            : { flex: `${flexVal} 1 0%` }
                        }
                      >
                        {slot.type === "single" ? (
                          /* 1) 단일 컴포넌트 렌더링 */
                          <div
                            className={
                              isMetricsFixed
                                ? "w-full max-h-full flex flex-col min-h-0 overflow-hidden p-[1.5px]"
                                : "w-full h-full flex flex-col min-h-0 overflow-hidden p-[1.5px]"
                            }
                          >
                            {renderPanel(slot.panel)}
                          </div>
                        ) : (
                          /* 2) 가로 2개 묶음 렌더링 + 내부 좌우 가로 스플리터 바 */
                          <div className="w-full h-full flex min-h-0 overflow-hidden relative">
                            <div
                              className="flex flex-col min-h-0 overflow-hidden p-[1.5px]"
                              style={{ width: `${slot.pairRatio ?? 50}%` }}
                            >
                              {renderPanel(slot.left)}
                            </div>

                            {/* 2개 묶음 내부 좌우 분할 조절 스플리터 바 */}
                            <div
                              onMouseDown={(e) => {
                                if (e.detail === 2) {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  onPairReset?.(secIdx, slotIdx);
                                  return;
                                }
                                onPairResizeStart(
                                  secIdx,
                                  slotIdx,
                                  slot.pairRatio ?? 50,
                                  e
                                );
                              }}
                              onDoubleClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onPairReset?.(secIdx, slotIdx);
                              }}
                              title="좌우로 드래그하여 가로 분할 비율 조절 (더블클릭: 50:50 리셋)"
                              className="w-2.5 -mx-0.5 relative flex items-center justify-center cursor-col-resize group shrink-0 z-20 hover:bg-[var(--ar-accent)]/10 rounded-sm transition-colors"
                            >
                              <div
                                className={`w-[3px] rounded-full transition-all duration-200 ${
                                  resizingPair?.secIdx === secIdx &&
                                  resizingPair?.slotIdx === slotIdx
                                    ? "h-16 bg-[var(--ar-accent)] shadow-sm"
                                    : "h-8 bg-[#D0D7DE] group-hover:h-14 group-hover:bg-[var(--ar-accent)]"
                                }`}
                              />
                            </div>

                            <div
                              className="flex flex-col min-h-0 overflow-hidden p-[1.5px]"
                              style={{
                                width: `${100 - (slot.pairRatio ?? 50)}%`,
                              }}
                            >
                              {renderPanel(slot.right)}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 세로 슬롯 간 실시간 높이 조절 스플리터 바 */}
                      {slotIdx < section.slots.length - 1 && section.id !== "sec-5" && (
                        <div
                          onMouseDown={(e) => {
                            if (e.detail === 2) {
                              e.preventDefault();
                              e.stopPropagation();
                              onSlotReset?.(secIdx, slotIdx);
                              return;
                            }
                            const topSlot = section.slots[slotIdx];
                            const btmSlot = section.slots[slotIdx + 1];
                            const topRatio = topSlot?.flexRatio ?? 1;
                            const btmRatio = btmSlot?.flexRatio ?? 1;
                            onSlotResizeStart(
                              secIdx,
                              slotIdx,
                              topRatio,
                              btmRatio,
                              e
                            );
                          }}
                          onDoubleClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onSlotReset?.(secIdx, slotIdx);
                          }}
                          title="위아래로 드래그하여 슬롯 높이 비율 조절 (더블클릭: 기본 리셋)"
                          className="h-2.5 -my-0.5 relative flex items-center justify-center cursor-row-resize group shrink-0 z-20 hover:bg-[var(--ar-accent)]/10 rounded-sm transition-colors"
                        >
                          <div
                            className={`h-[3px] rounded-full transition-all duration-200 ${
                              resizingRowSlot?.secIdx === secIdx &&
                              resizingRowSlot?.slotIdx === slotIdx
                                ? "w-24 bg-[var(--ar-accent)] shadow-sm"
                                : "w-10 bg-[#D0D7DE] group-hover:w-20 group-hover:bg-[var(--ar-accent)]"
                            }`}
                          />
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          );
        })}

        {mobileExtraSection && (
          <div className="flex md:hidden h-full min-h-0 shrink-0 w-full overflow-hidden p-[1.5px]">
            {mobileExtraSection}
          </div>
        )}
      </div>
    </div>
  );
};

export default SlidingViewportTrack;

