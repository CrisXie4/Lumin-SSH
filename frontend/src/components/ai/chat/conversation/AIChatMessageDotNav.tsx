import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Z } from '../../../../constants/zIndex.ts';
import { useTranslation } from '../../../../i18n.ts';
import { cn } from '../../../../utils/cn.ts';
import type { GroupedConversationEntry } from './conversationTypes.ts';

export interface UserMessageNavEntry {
  entry: Extract<GroupedConversationEntry, { type: 'user' }>;
  index: number;
}

export interface AIChatMessageDotNavProps {
  userMessageEntries: UserMessageNavEntry[];
  messageNavEnabled: boolean;
  isLeftSide: boolean;
  activeMessageIndex?: number;
  onJumpToUserMessage: (targetIndex: number, entry: GroupedConversationEntry) => void;
}

// ponytail: 圆点条只显示当前位置附近的窗口（悬停弹出完整跳转列表），改窗口大小调这里
const MAX_VISIBLE_DOTS = 9;

export default function AIChatMessageDotNav({
  userMessageEntries,
  messageNavEnabled,
  isLeftSide,
  activeMessageIndex = -1,
  onJumpToUserMessage,
}: AIChatMessageDotNavProps) {
  const { t } = useTranslation();
  const [hoveredGroupedIndex, setHoveredGroupedIndex] = useState(-1);
  const [listOpen, setListOpen] = useState(false);
  const [anchorY, setAnchorY] = useState(0);
  const [listTop, setListTop] = useState(0);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef(0);

  const cancelClose = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = 0;
    }
  };

  // ponytail: 150ms 延迟关闭，跨越圆点条与弹出列表之间的空隙时不闪断
  const scheduleClose = () => {
    cancelClose();
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = 0;
      setListOpen(false);
      setHoveredGroupedIndex(-1);
    }, 150);
  };

  const openList = (groupedIdx: number, dot: HTMLElement) => {
    cancelClose();
    const wrapper = wrapperRef.current;
    // 仅在列表未打开时锚定：打开期间在点间移动只改高亮，列表位置保持稳定
    if (!listOpen && wrapper) {
      const dotRect = dot.getBoundingClientRect();
      const wrapperRect = wrapper.getBoundingClientRect();
      setAnchorY(dotRect.top - wrapperRect.top + dotRect.height / 2);
    }
    setHoveredGroupedIndex(groupedIdx);
    setListOpen(true);
  };

  useEffect(() => () => cancelClose(), []);

  // 列表渲染后按实测高度垂直居中并夹进容器范围，保证任何点位弹出都完整可见
  useLayoutEffect(() => {
    if (!listOpen) {
      return;
    }
    const list = listRef.current;
    const wrapper = wrapperRef.current;
    if (!list || !wrapper) {
      return;
    }
    const listH = list.offsetHeight;
    const wrapperH = wrapper.clientHeight;
    const centered = anchorY - listH / 2;
    setListTop(Math.max(0, Math.min(centered, wrapperH - listH)));
  }, [listOpen, anchorY]);

  if (userMessageEntries.length < 1 || !messageNavEnabled) {
    return null;
  }

  // 以"当前消息"为中心的圆点窗口；位置未知时回退到最新一条
  const activePos = userMessageEntries.findIndex(({ index }) => index === activeMessageIndex);
  const pos = activePos >= 0 ? activePos : userMessageEntries.length - 1;
  const windowStart = Math.max(0, Math.min(pos - Math.floor(MAX_VISIBLE_DOTS / 2), userMessageEntries.length - MAX_VISIBLE_DOTS));
  const visibleEntries = userMessageEntries.slice(windowStart, windowStart + MAX_VISIBLE_DOTS);

  return (
    <div
      ref={wrapperRef}
      style={{ zIndex: Z.PANEL_BUTTON }}
      onMouseLeave={scheduleClose}
      className={cn('absolute bottom-[44px] top-[14px] flex flex-col justify-center', isLeftSide ? 'right-[3px]' : 'left-[3px]')}>
      {/* ponytail: 单个子项 my-auto 实现少量圆点垂直居中 */}
      <div className="my-auto flex flex-none flex-col items-center gap-[5px]">
        {visibleEntries.map(({ entry, index }) => {
        const navText = typeof entry.message?.text === 'string' ? entry.message.text.trim() : '';
        const navPreview = navText.length > 60 ? navText.slice(0, 60) + '…' : navText;
        const isNavHovered = hoveredGroupedIndex === index;
        const isActiveNav = index === activeMessageIndex;
        return (
          <div
            key={entry.message?.id || `nav-${index}`}
            className="relative flex justify-center"
            onMouseEnter={(event) => openList(index, event.currentTarget)}
          >
            <button
              type="button"
              onClick={() => onJumpToUserMessage(index, entry)}
              aria-label={navPreview || t('图片消息')}
              aria-current={isActiveNav ? 'true' : undefined}
              style={{ transform: isNavHovered || isActiveNav ? 'scale(1.4)' : 'scale(1)' }}
              className={cn(
                'h-[7px] w-[7px] cursor-pointer rounded-[2px] border border-line p-0 [transition:transform_150ms_ease,background_150ms_ease,border-color_150ms_ease]',
                isNavHovered || isActiveNav ? 'bg-accent' : 'bg-overlay',
              )}
            />
          </div>
        );
        })}
      </div>
      {listOpen && hoveredGroupedIndex >= 0 ? (
        <div
          ref={listRef}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          style={{ top: listTop, zIndex: Z.POPUP }}
          className={cn(
            'absolute max-h-full w-max min-w-[180px] max-w-[320px] overflow-y-auto rounded-lg bg-[rgba(30,35,42,0.96)] py-1 shadow-lg',
            isLeftSide ? 'right-full mr-2.5' : 'left-full ml-2.5',
          )}>
          {userMessageEntries.map(({ entry, index }) => {
            const navText = typeof entry.message?.text === 'string' ? entry.message.text.trim() : '';
            const isRowHovered = hoveredGroupedIndex === index;
            const isRowActive = index === activeMessageIndex;
            return (
              <button
                key={entry.message?.id || `nav-row-${index}`}
                type="button"
                onClick={() => {
                  onJumpToUserMessage(index, entry);
                  setListOpen(false);
                  setHoveredGroupedIndex(-1);
                }}
                onMouseEnter={() => setHoveredGroupedIndex(index)}
                aria-current={isRowActive ? 'true' : undefined}
                className={cn(
                  'block w-full max-w-full cursor-pointer truncate px-2.5 py-1.5 text-left text-sm leading-[1.6]',
                  isRowHovered ? 'bg-[rgba(255,255,255,0.1)]' : '',
                  isRowActive ? 'text-accent' : 'text-white/90',
                )}
              >
                {navText || t('图片消息')}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
