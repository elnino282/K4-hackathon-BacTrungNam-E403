export interface VisiblePageRect {
  pageNumber: number;
  top: number;
  bottom: number;
}

export function getMostVisiblePage(
  viewportTop: number,
  viewportBottom: number,
  pages: VisiblePageRect[],
): number | null {
  if (viewportBottom <= viewportTop) return null;
  const viewportCenter = (viewportTop + viewportBottom) / 2;

  let best:
    | {
        pageNumber: number;
        visibleHeight: number;
        centerDistance: number;
      }
    | undefined;

  for (const page of pages) {
    const visibleHeight = Math.max(
      0,
      Math.min(page.bottom, viewportBottom)
        - Math.max(page.top, viewportTop),
    );
    if (visibleHeight <= 0) continue;

    const pageCenter = (page.top + page.bottom) / 2;
    const candidate = {
      pageNumber: page.pageNumber,
      visibleHeight,
      centerDistance: Math.abs(pageCenter - viewportCenter),
    };
    if (
      !best
      || candidate.visibleHeight > best.visibleHeight
      || (
        candidate.visibleHeight === best.visibleHeight
        && candidate.centerDistance < best.centerDistance
      )
    ) {
      best = candidate;
    }
  }

  return best?.pageNumber ?? null;
}
