; Keywords, some need special handling due to conflicts.
[
  (initial)
  "type"
] @keyword
(_ keyword: _ @keyword)

; Comments
[
  (line_comment)
  (block_comment)
] @comment

; Types and modules
"abap" @module
(builtin_type name: (identifier) @type.builtin)
(simple_type_definition name: (identifier) @type)
(simple_type_definition type: (identifier) @type)
(enum_type_definition name: (identifier) @type)
(enum_type_definition base_type: (identifier) @type)
(scalar_typing type: (identifier) @type)

; Functions and parameters
(scalar_function_definition name: (identifier) @function)
(function_parameter name: (identifier) @variable.parameter)
(type_of parameter: (identifier) @variable.parameter)
(reference_type_of parameter: (identifier) @variable.parameter)
(reference_type_constraint parameter: (identifier) @variable.parameter)

; Services
(service_definition name: (identifier) @module)
(provider_contracts scenario: (identifier) @constant.builtin)
(exposed_entity name: (identifier) @type)
(exposed_entity (alias name: (identifier) @type))
(method_qualifier
  class: (identifier) @type
  name: (identifier) @function.method)
(exposed_method (alias name: (identifier) @function))

; Constants
(enum_constant_definition name: (identifier) @constant)
(enum_literal) @constant

[
  (boolean_literal)
  (null_literal)
] @constant.builtin

; Literals
[
  (integer_literal)
  (decimal_literal)
  (scientific_literal)
] @number

(string_literal) @string

; Annotations
[
  "@"
  "@<"
] @attribute

(annotation name: [(identifier) (sub_annotation)] @attribute)
(annotation_property name: [(identifier) (sub_annotation)] @property)

; Punctuation
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

; Operators
[
  "="
  "=>"
] @operator
