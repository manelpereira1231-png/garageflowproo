import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import { Link } from "react-router-dom";

const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    "*": [...(defaultSchema.attributes?.["*"] || []), "id", "className"],
    img: [...(defaultSchema.attributes?.img || []), "loading", "alt", "src", "title"],
    a: [...(defaultSchema.attributes?.a || []), "target", "rel", "href"],
  },
};

function isInternal(href?: string) {
  if (!href) return false;
  return href.startsWith("/") || href.startsWith("#") || href.startsWith("https://garageflow.pt");
}

/**
 * Renders stored Markdown (with optional trusted inline HTML) into semantic,
 * sanitized HTML with SaaS-blog typography.
 */
export default function MarkdownArticle({ content }: { content: string }) {
  return (
    <div className="gf-article prose prose-lg dark:prose-invert max-w-none prose-headings:scroll-mt-24 prose-headings:font-bold prose-headings:tracking-tight prose-h2:text-2xl sm:prose-h2:text-3xl prose-h2:mt-12 prose-h2:mb-4 prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3 prose-p:leading-[1.8] prose-p:text-foreground/90 prose-a:text-primary prose-a:font-medium prose-a:no-underline hover:prose-a:underline prose-strong:text-foreground prose-li:leading-[1.8] prose-li:marker:text-primary prose-blockquote:border-l-4 prose-blockquote:border-primary/60 prose-blockquote:bg-primary/5 prose-blockquote:rounded-r-lg prose-blockquote:py-1 prose-blockquote:px-5 prose-blockquote:not-italic prose-blockquote:text-foreground/80 prose-img:rounded-xl prose-img:shadow-sm prose-hr:border-border prose-code:before:content-none prose-code:after:content-none prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:bg-muted prose-pre:text-foreground prose-pre:border prose-pre:border-border prose-th:text-left">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeRaw,
          [rehypeSanitize, schema],
          rehypeSlug,
          [rehypeAutolinkHeadings, { behavior: "wrap" }],
        ]}
        components={{
          a: ({ href, children, ...rest }) => {
            const url = String(href || "");
            if (isInternal(url) && url.startsWith("/")) {
              return (
                <Link to={url} {...(rest as any)}>
                  {children}
                </Link>
              );
            }
            return (
              <a
                href={url}
                {...rest}
                {...(isInternal(url)
                  ? {}
                  : { target: "_blank", rel: "noopener noreferrer nofollow" })}
              >
                {children}
              </a>
            );
          },
          img: ({ src, alt, ...rest }) => (
            <figure>
              <img src={String(src || "")} alt={alt || ""} loading="lazy" decoding="async" {...rest} />
              {alt ? <figcaption className="text-center text-sm text-muted-foreground">{alt}</figcaption> : null}
            </figure>
          ),
          table: ({ children, ...rest }) => (
            <div className="overflow-x-auto my-6 rounded-lg border border-border">
              <table className="w-full m-0" {...rest}>
                {children}
              </table>
            </div>
          ),
        }}
      >
        {content || ""}
      </ReactMarkdown>
    </div>
  );
}
