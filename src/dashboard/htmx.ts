import "typed-htmx";

declare global {
  // biome-ignore lint/style/noNamespace: declaration merging
  namespace JSX {
    // Extend JSX HTML attributes with htmx attributes when JSX is used
    // Note: Our dashboard currently uses template literals, not TSX
    interface HTMLAttributes extends HtmxAttributes {}
  }
}
