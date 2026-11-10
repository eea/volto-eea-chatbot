import React from 'react';

/**
 * Render a source document with the evidence segments of a claim highlighted.
 *
 * Segment offsets are half-open ranges `[startOffset, endOffset)` expressed in
 * the coordinates of the *joined* sources string, so they are shifted by
 * `sourceStartIndex` before slicing this source's text.
 *
 * A claim can be supported by several evidence quotes, and those quotes can
 * overlap (two passages covering the same sentence, for example). Because the
 * renderer splits the text on segment boundaries, overlapping segments would
 * emit the same characters twice — segments are therefore clipped to what is
 * still uncovered, and a fully covered segment keeps its id on the segment that
 * covers it so its "Jump to citation" chip still scrolls somewhere sensible.
 */
export const RenderClaimView = (props) => {
  const {
    value,
    visibleSegmentId,
    segmentContainerRef,
    spanRefs,
    segments = [],
    sourceStartIndex = 0,
  } = props;

  const sortedSegments = [...segments]
    .filter(
      (segment) =>
        Number.isFinite(segment.startOffset) &&
        Number.isFinite(segment.endOffset),
    )
    .sort((a, b) => a.startOffset - b.startOffset);

  const parts = [];
  let lastIndex = 0;
  let lastSegmentPart = null;

  sortedSegments.forEach((segment) => {
    const segmentStart = Math.max(
      0,
      segment.startOffset - sourceStartIndex,
      lastIndex,
    );
    const segmentEnd = Math.min(
      value.length,
      segment.endOffset - sourceStartIndex,
    );

    if (segmentEnd <= segmentStart) {
      // Nothing left of this segment — it is covered by the previous one.
      if (lastSegmentPart) {
        lastSegmentPart.ids.push(segment.id);
      }
      return;
    }

    // Add the text part before the current segment
    if (segmentStart > lastIndex) {
      parts.push({
        type: 'text',
        content: value.slice(lastIndex, segmentStart),
      });
    }

    // Add the segment part
    const part = {
      type: 'segment',
      ids: [segment.id],
      content: value.slice(segmentStart, segmentEnd),
    };
    parts.push(part);
    lastSegmentPart = part;
    lastIndex = segmentEnd;
  });

  // Add the remaining text part after the last segment
  if (lastIndex < value.length) {
    parts.push({
      type: 'text',
      content: value.slice(lastIndex),
    });
  }

  return (
    <div className="citation-text-container" ref={segmentContainerRef}>
      <div className="citation-text-content">
        {parts.map((part, index) => {
          const endline = part.content.endsWith('\n');
          const content = part.content.split('\n');

          if (part.type === 'segment') {
            const isSelectedSegment = part.ids.includes(visibleSegmentId);
            return (
              <React.Fragment key={part.ids.join('-') || index}>
                <span
                  ref={(el) => {
                    if (el) {
                      part.ids.forEach((id) => {
                        spanRefs.current[id] = el;
                      });
                    }
                  }}
                  className={`citation-segment ${
                    isSelectedSegment ? 'active' : ''
                  }`}
                >
                  <mark className="citation-highlight">
                    {part.content.trim()}
                    {part.ids.map((id) => (
                      <sup key={id} className="citation-ref">
                        {id}
                      </sup>
                    ))}
                  </mark>
                  {!endline && <>&nbsp;</>}
                </span>
                {endline && <span className="br" />}
              </React.Fragment>
            );
          }

          return (
            <React.Fragment key={index}>
              {content
                .filter((line) => !/^(DOCUMENT |Source)/.test(line))
                .map((line, lineIndex) => (
                  <React.Fragment key={lineIndex}>
                    <span className="citation-line">{line}</span>
                    {lineIndex < content.length - 1 && <span className="br" />}
                  </React.Fragment>
                ))}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
