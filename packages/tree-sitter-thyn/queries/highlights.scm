; Tags
(tag_name) @tag

; Directive attributes (#for, #if, etc.)
(directive_attribute
  "#" @operator
  (directive_name) @keyword)

; Regular attributes (e.g., class="button")
(regular_attribute
  (attribute_name) @attribute
  (quoted_string) @string)

; Quoted JavaScript expressions (e.g., {() => items(v => [...v, v.length])})
(quoted_expression) @function.call

; Interpolation expressions (e.g., {{ item }})
(interpolation
  "{{" @punctuation.bracket
  (javascript_expression) @variable
  "}}" @punctuation.bracket)

; JavaScript content in <script> tags
(javascript_content) @source.js

; CSS content in <style> tags
(css_content) @source.css

; Comments
(comment) @comment

