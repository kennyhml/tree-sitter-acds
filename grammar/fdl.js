/**
 * @file CDS Function Definition Language (FDL) rules
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

/** @type {RuleBuilders<string, never>} */
export const functionDefinitionRules = {
  /*
   * DEFINE SCALAR FUNCTION ScalarFunction
   *   [WITH PARAMETERS pname1 : typing
   *                    [, pname2 : typing]
   *                    [, ...]]
   *   RETURNS typing[;]
   *
   * @see https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/ABENCDS_DEFINE_SCALAR_FUNCTION.html
   */
  scalar_function_definition: ($) =>
    seq(
      ...kws("define", "scalar", "function"),
      field("name", $.identifier),
      optional(field("parameters", $.function_parameters)),
      field("returns", $.function_return_type),
      optional(";"),
    ),

  function_return_type: ($) =>
    seq(kw("returns"), field("type", $.scalar_typing)),

  /*
   * ... [WITH PARAMETERS pname1 : typing
   *                    [, pname2 : typing]
   *                    [, ...]] ...
   *
   * Needs a dedicated rule because it has no annotation and different typing for
   * the parameters that is not worth being permissive over - just adds ambiguity.
   */
  function_parameters: ($) =>
    seq(...kws("with", "parameters"), commaSep1($.function_parameter)),

  /*
   * ... [@parameter_annot1]
   *     [@parameter_annot2]
   *     ...
   *     pname : typing
   *     [@<parameter_annot1]
   *     [@<parameter_annot2]
   *     ...
   *
   * @see https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/ABENCDS_F1_PARAM.html
   */
  view_parameter: ($) =>
    seq(
      field("name", $.identifier),
      ":",
      choice($._type_identifier, $.builtin_type),
    ),

  function_parameter: ($) =>
    seq(field("name", $.identifier), ":", field("type", $.scalar_typing)),

  /*
   * dtype                      [WITH REFERENCE TYPE]
   * | simple_type              [WITH REFERENCE TYPE]
   * | data_element             [WITH REFERENCE TYPE]
   * | generic_type             [WITH REFERENCE TYPE]
   * | TYPE OF ParameterReference [WITH REFERENCE TYPE]
   *
   * @see https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/ABENCDS_SCALAR_TYPING.html
   */
  scalar_typing: ($) =>
    seq(
      field(
        "type",
        choice(
          $._type_identifier,
          alias(token(prec(1, /type/i)), $.identifier), // conflict with TYPE OF ...
          $.builtin_type,
          $.type_of,
        ),
      ),
      optional(field("reference_type", $.parameter_reference_type)),
    ),

  type_of: ($) =>
    seq(
      alias(token(prec(1, /type/i)), "type"),
      kw("of"),
      field("parameter", $.identifier),
    ),

  /*
   * 1. Static Reference Type Specification
   * WITH REFERENCE TYPE #CUKY | #UNIT | #CALC | #NONE
   * | WITH REFERENCE TYPE [#CUKY, #UNIT, REFERENCE TYPE OF pname, ...]
   * | WITH REFERENCE TYPE OF pname
   *
   * 2. Dynamic Reference Type Specification
   *
   * WITH REFERENCE TYPE
   * CASE
   * WHEN pname1: reference [AND pname2: reference][AND...]
   *  THEN reference
   * [WHEN ... [AND ... ] THEN ...]
   *  [ELSE reference]
   * END
   *
   * @see https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/ABENCDS_WITH_REFERENCE_TYPE.html
   */
  parameter_reference_type: ($) =>
    choice(
      seq(
        ...kws("with", "reference", "type"),
        field(
          "type",
          choice($.enum_literal, $.reference_types, $.reference_type_case),
        ),
      ),
      seq(kw("with"), field("type", $.reference_type_of)),
    ),

  // ... REFERENCE TYPE OF pname ...
  reference_type_of: ($) =>
    seq(...kws("reference", "type", "of"), field("parameter", $.identifier)),

  // ... [ #CUKY, #UNIT, #CALC, ... ] ...
  reference_types: ($) =>
    seq("[", commaSep1(choice($.enum_literal, $.reference_type_of)), "]"),

  /*
   * WITH REFERENCE TYPE
   * CASE
   * WHEN pname1: reference [AND pname2: reference][AND...]
   *  THEN reference
   * [WHEN ... [AND ... ] THEN ...]
   *  [ELSE reference]
   * END
   *
   * Requiring ELSE for return parameters is left to contextual validation.
   */
  reference_type_case: ($) =>
    seq(
      kw("case"),
      repeat1($.reference_type_when_clause),
      optional(
        seq(
          kw("else"),
          field("else", choice($.enum_literal, $.reference_type_of)),
        ),
      ),
      kw("end"),
    ),

  /*
   * WHEN pname1: reference [AND pname2: reference][AND...]
   *    THEN reference
   */
  reference_type_when_clause: ($) =>
    seq(
      kw("when"),
      field("condition", $.reference_type_condition),
      kw("then"),
      field("consequence", choice($.enum_literal, $.reference_type_of)),
    ),

  // ... when pname1: { reference / reference type of pname } [and ...] ...
  reference_type_condition: ($) =>
    seq(
      $.reference_type_constraint,
      repeat(seq(kw("and"), $.reference_type_constraint)),
    ),

  // ...pname1: { reference / reference type of pname } ...
  reference_type_constraint: ($) =>
    seq(
      field("parameter", $.identifier),
      ":",
      field("type", choice($.enum_literal, $.reference_type_of)),
    ),
};

/**
 * @param {string} word
 */
function kw(word) {
  return field("keyword", alias(new RegExp(word, "i"), word));
}

/**
 * @param {string[]} words
 */
function kws(...words) {
  return words.map(kw);
}

/**
 * @param {RuleOrLiteral} rule
 */
function commaSep1(rule) {
  return seq(rule, repeat(seq(",", rule)));
}
