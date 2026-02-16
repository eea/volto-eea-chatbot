import React from 'react';
import { ClaimModal } from './ClaimModal';
import { Citation } from './Citation';
import { transformEmailsToLinks } from '../../utils';

export function components(message, markers, citedSources) {
  return {
    table: (props) => {
      const { node, children, ...rest } = props;
      return (
        <table className="ui celled table" {...rest}>
          {children}
        </table>
      );
    },
    td: (props) => {
      const { node, children, ...rest } = props;
      // Process children to replace <br> strings with actual line breaks
      const processedChildren = React.Children.map(children, (child) => {
        if (typeof child === 'string' && child.includes('<br>')) {
          // Split by <br> and insert actual <br /> elements
          const parts = child.split('<br>');
          return parts.reduce((acc, part, index) => {
            acc.push(part);
            if (index < parts.length - 1) {
              acc.push(<br key={`br-${index}`} />);
            }
            return acc;
          }, []);
        }
        return child;
      });
      return <td {...rest}>{processedChildren}</td>;
    },
    span: (props) => {
      const { node, children } = props;
      const child = node.children[0];

      // identifies if the current text belongs to a claim
      if (child.type === 'text' && child.position && markers) {
        const text = child.value || '';
        const start = child.position.start.offset;
        const end = child.position.end.offset;
        const claims = markers.claims?.filter(
          (claim) =>
            claim.score !== null &&
            ((start >= claim.startOffset && end <= claim.endOffset) ||
              (start <= claim.endOffset && end >= claim.endOffset) ||
              (start <= claim.startOffset && end >= claim.startOffset)),
        );

        if (claims && claims.length > 0) {
          let relStart = 0;
          const claimsSegments = claims.map((claim) => ({
            claim,
            start: Math.max(0, claim.startOffset - start),
            end: Math.min(text.length, claim.endOffset - start),
          }));
          const segments = claimsSegments.reduce((acc, segment) => {
            if (relStart < segment.start) {
              acc.push(child.value.substring(relStart, segment.start));
            }
            const claimText = child.value.substring(segment.start, segment.end);
            acc.push(
              <ClaimModal
                claim={segment.claim}
                markers={markers}
                text={claimText}
                citedSources={citedSources}
              />,
            );
            relStart = segment.end;
            return acc;
          }, []);

          if (relStart < text.length) {
            segments.push(text.substring(relStart));
          }

          return segments;
        }

        return text;
      }

      return children || [];
    },
    a: (props) => {
      const { node, children, href, ...rest } = props;
      const value = children?.toString() || '';

      // Check for blinking dot indicator
      if (value?.startsWith('*')) {
        return <div className="" />;
      }

      // Check if this is a citation pattern [number]
      if (value?.startsWith('[') && value?.endsWith(']')) {
        const match = value.match(/\[(\d+)\]/);
        if (match) {
          // This is a citation - render Citation component
          return (
            <Citation link={href} value={value} message={message}>
              {children}
            </Citation>
          );
        }
      }

      // Regular link - render normal anchor
      const handleClick = (event) => {
        if (href) {
          event.preventDefault();
          window.open(href, '_blank');
        }
      };

      return (
        <a href={href} onClick={handleClick} {...rest}>
          {children}
        </a>
      );
    },
    p: ({ node, ...props }) => {
      // TODO: reimplement this with rehype
      const children = props.children;
      const text = React.Children.map(children, (child) => {
        if (typeof child === 'string') {
          return transformEmailsToLinks(child);
        }
        return child;
      });

      return (
        <p {...props} className="text-default">
          {text}
        </p>
      );
    },
  };
}
