module.exports = grammar({
  name: "thyn",
  rules: {
    source_file: $ => repeat($._statement),

    script_tag: $ => seq(
      "<script>",
      optional($.javascript_content),
      "</script>"
    ),

    // Pure JavaScript content for <script> tags
    javascript_content: $ => token(prec(1, /[^<]+/)),

    _statement: $ => choice(
      $.script_tag,
      $.tag
    ),

    tag: $ => seq(
      "<",
      $.tag_name,
      optional($.attributes),
      ">",
      optional($.content),
      "</",
      $.tag_name,
      ">"
    ),

    // Added content rule to handle mixed content better
    content: $ => repeat1(
      choice(
        $.text,
        $.interpolation,
        $.tag
      )
    ),

    tag_name: $ => /[a-zA-Z][a-zA-Z0-9-]*/,

    attributes: $ => repeat1($.attribute),

    attribute: $ => choice(
      $.handler_attribute,
      $.directive_attribute,
      $.regular_attribute
    ),

    // Fixed: Added optional whitespace handling
    handler_attribute: $ => seq(
      "@",
      $.handler_name,
      optional(/\s+/),
      "=",
      optional(/\s*/),
      $.quoted_expression
    ),

    // Fixed: Added optional whitespace handling
    directive_attribute: $ => seq(
      "#",
      $.directive_name,
      optional(/\s+/),
      "=",
      optional(/\s*/),
      $.quoted_expression
    ),

    regular_attribute: $ => seq(
      $.attribute_name,
      optional(/\s*/),
      "=",
      optional(/\s*/),
      $.quoted_string
    ),

    handler_name: $ => /[a-zA-Z][a-zA-Z0-9]*/,
    directive_name: $ => /[a-zA-Z][a-zA-Z0-9]*/,
    attribute_name: $ => /[a-zA-Z][a-zA-Z0-9-]*/,

    quoted_string: $ => seq(
      '"',
      optional($.string_content),
      '"'
    ),

    quoted_expression: $ => seq(
      "{",
      optional(/\s*/),
      $.expression_content,
      optional(/\s*/),
      "}"
    ),

    // Improved text matching to handle whitespace better
    text: $ => token(prec(-1, /[^<{]+/)),

    interpolation: $ => seq(
      "{{",
      optional(/\s*/),
      $.expression_content,
      optional(/\s*/),
      "}}"
    ),

    // Fixed: Better expression content handling
    expression_content: $ => token(repeat1(/[^}]+/)),

    // Fixed: Allow empty strings
    string_content: $ => token(/[^"]*/),

    // Add whitespace rule for explicit whitespace handling where needed
    _whitespace: $ => token(/\s+/)
  }
});
