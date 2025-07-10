module.exports = grammar({
  name: "thyn",
  
  rules: {
    source_file: $ => repeat($._statement),

    _statement: $ => choice(
      $.script_tag,
      $.tag
    ),

    script_tag: $ => seq(
      "<script>",
      optional($.javascript_content),
      "</script>"
    ),

    javascript_content: $ => repeat1($._js_statement),

    _js_statement: $ => choice(
      $.variable_declaration,
      $.expression_statement
    ),

    variable_declaration: $ => seq(
      choice("const", "let", "var"),
      $.identifier,
      "=",
      $._js_expression,
      ";"
    ),

    expression_statement: $ => seq(
      $._js_expression,
      ";"
    ),

    _js_expression: $ => choice(
      $.signal_call,
      $.array,
      $.arrow_function,
      $.function_call,
      $.parenthesized_expression,
      $.spread_expression,
      $.property_access,
      $.for_expression,
      $.identifier,
      $.number,
      $.string_literal
    ),

    signal_call: $ => seq(
      "$signal",
      "(",
      $._js_expression,
      ")"
    ),

    array: $ => seq(
      "[",
      optional(seq(
        $._js_expression,
        repeat(seq(",", optional(/\s*/), $._js_expression)),
        optional(",")
      )),
      "]"
    ),

    function_call: $ => prec.left(3, seq(
      $._js_expression,
      "(",
      optional(seq(
        $._js_expression,
        repeat(seq(",", optional(/\s*/), $._js_expression))
      )),
      ")"
    )),

    arrow_function: $ => prec.right(2, seq(
      choice(
        $.identifier,
        seq("(", optional($.parameter_list), ")")
      ),
      "=>",
      $._js_expression
    )),

    parameter_list: $ => prec(1, seq(
      $.identifier,
      repeat(seq(",", $.identifier))
    )),

    spread_expression: $ => prec.right(3, seq(
      "...",
      $._js_expression
    )),

    property_access: $ => prec.left(4, seq(
      $._js_expression,
      ".",
      $.identifier
    )),

    parenthesized_expression: $ => seq(
      "(",
      $._js_expression,
      ")"
    ),

    open_tag_start: $ => token("<"),
    open_tag_end: $ => token(">"),
    close_tag_start: $ => token("</"),
    close_tag_end: $ => token(">"),

    tag: $ => seq(
      $.open_tag_start,
      $.tag_name,
      optional($.attributes),
      $.open_tag_end,
      optional($.content),
      $.close_tag_start,
      $.tag_name,
      $.close_tag_end
    ),

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
      $.event_attribute,
      $.directive_attribute,
      $.regular_attribute
    ),

    event_attribute: $ => prec(3, seq(
      $.event_name,
      "=",
      $.expression_block
    )),

    directive_attribute: $ => prec(2, seq(
      "#",
      $.identifier,
      "=",
      $.expression_block
    )),

    regular_attribute: $ => prec(1, seq(
      $.attribute_name,
      "=",
      $.quoted_string
    )),

    event_name: $ => token(prec(10, /on[a-zA-Z][a-zA-Z0-9]*/)),
    attribute_name: $ => token(prec(1, /[a-zA-Z][a-zA-Z0-9-]*/)),

    quoted_string: $ => seq(
      '"',
      optional($.string_content),
      '"'
    ),

    string_content: $ => /[^"]*/,

    expression_block: $ => seq(
      "{",
      $._js_expression,
      "}"
    ),

    interpolation: $ => seq(
      "{{",
      $._js_expression,
      "}}"
    ),

    // Special for directive expressions like "item of items()"
    for_expression: $ => prec.right(2, seq(
      $.identifier,
      "of",
      $._js_expression
    )),

    text: $ => /[^<{]+/,

    identifier: $ => /[a-zA-Z_][a-zA-Z0-9_]*/,

    number: $ => /\d+(\.\d+)?/,

    string_literal: $ => seq(
      '"',
      optional(/[^"]*/),
      '"'
    )
  },

  extras: $ => [
    /\s+/,
    /\/\/.*\n/,
    /\/\*[^*]*\*+([^/*][^*]*\*+)*\//
  ],

  conflicts: $ => [
    [$.function_call, $.identifier],
    [$.for_expression, $._js_expression],
    [$._js_expression, $.parameter_list]
  ]
});
