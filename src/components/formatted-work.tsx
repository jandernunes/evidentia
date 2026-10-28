import Markdown from "react-markdown";

export function FormattedWork({ content, format }: { content: string; format: string }) {
  if (format !== "MARKDOWN") return <div className="prose">{content}</div>;
  return (
    <div className="formatted-work">
      <Markdown
        skipHtml
        allowedElements={[
          "p",
          "br",
          "strong",
          "em",
          "ul",
          "ol",
          "li",
          "blockquote",
          "pre",
          "code",
          "a",
          "hr",
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
        ]}
        urlTransform={(url) => (/^(https?:\/\/|mailto:)/i.test(url) ? url : undefined)}
        components={{
          h1: ({ children }) => <h4>{children}</h4>,
          h2: ({ children }) => <h4>{children}</h4>,
          h3: ({ children }) => <h4>{children}</h4>,
          h5: ({ children }) => <h4>{children}</h4>,
          h6: ({ children }) => <h4>{children}</h4>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}
