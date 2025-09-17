import "typed-htmx";

declare module "hono/jsx" {
  // biome-ignore lint/style/noNamespace: declaration merging
  namespace JSX {
    interface HTMLAttributes extends HtmxAttributes {}
  }
}
