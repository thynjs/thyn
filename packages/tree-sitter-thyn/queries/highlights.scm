; HTML Tags
(tag_name) @tag

; Attributes
(event_attribute
  (event_name) @function.method)

(directive_attribute
  "#" @operator
  (identifier) @keyword)

(regular_attribute
  (attribute_name) @attribute
  (quoted_string) @string)

; JavaScript expressions in attributes
(expression_block
  "{" @punctuation.bracket
  "}" @punctuation.bracket)

; Interpolation expressions
(interpolation
  "{{" @punctuation.bracket
  "}}" @punctuation.bracket)

; JavaScript content
(javascript_content) @source.js

; JavaScript expressions
(identifier) @variable
(number) @number
(string_literal) @string

; Function calls
(function_call
  (identifier) @function.call)

; Signal calls
(signal_call
  "$signal" @function.builtin)

; Arrow functions
(arrow_function
  "=>" @operator)

; Spread operator
(spread_expression
  "..." @operator)

; Property access
(property_access
  "." @operator)

; For expressions in directives
(for_expression
  (identifier) @variable
  "of" @keyword)

; Variable declarations
(variable_declaration
  ["const" "let" "var"] @keyword
  (identifier) @variable.declaration)

; Operators and punctuation
(open_tag_start) @punctuation.bracket
(open_tag_end) @punctuation.bracket
(close_tag_start) @punctuation.bracket
(close_tag_end) @punctuation.bracket
