[
  (line_comment)
  (block_comment)
] @comment

[
  (initial)
  "type"
] @keyword
(_ keyword: _ @keyword )

"abap" @module
(builtin_type
  name: (identifier) @type.builtin)

(simple_type_definition
  name: (identifier) @type)
(simple_type_definition
  type: (identifier) @type)
(enum_type_definition
  name: (identifier) @type)
(enum_type_definition
  base_type: (identifier) @type)
(scalar_typing
  type: (identifier) @type)

(scalar_function_definition
  name: (identifier) @function)
(function_parameter
  name: (identifier) @variable.parameter)
(type_of
  parameter: (identifier) @variable.parameter)
(reference_type_of
  parameter: (identifier) @variable.parameter)
(reference_type_constraint
  parameter: (identifier) @variable.parameter)

(enum_constant_definition
  name: (identifier) @constant)
(enum_literal) @constant

[
  (integer_literal)
  (decimal_literal)
  (scientific_literal)
] @number

(string_literal) @string

[
  (boolean_literal)
  (null_literal)
] @constant.builtin

[
  "@"
  "@<"
] @attribute

(annotation
  name: [(identifier) (sub_annotation)] @attribute)
(annotation_property
  name: [(identifier) (sub_annotation)] @property)

[
  "("
  ")"
  "["
  "]"
  "{"
  "}"
] @punctuation.bracket

[
  ","
  "."
  ":"
  ";"
] @punctuation.delimiter

"=" @operator
