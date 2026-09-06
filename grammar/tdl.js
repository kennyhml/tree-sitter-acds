/**
 * @file CDS Type Definition Language (TDL) rules
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

/** @type {RuleBuilders<string, never>} */
export const typeDefinitionRules = {
  /*
   * [@type_annot1]
   * [@type_annot2]
   * ...
   * DEFINE TYPE simple_type : dtype | data_element | simple_type
   *
   * We cannot tell data elements and simple types apart syntactically.
   *
   * Semicolons are optional for simple statements like this.
   *
   * @see https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/ABENCDS_DEFINE_SIMPLE_TYPE.html
   */
  simple_type_definition: ($) =>
    seq(
      repeat($.annotation),
      ...kws("define", "type"),
      field("name", $.identifier),
      ":",
      field("type", choice($.builtin_type, $._type_identifier)),
      optional(";"),
    ),

  /*
   * [@type_annot1]
   * [@type_annot2]
   * ...
   * DEFINE TYPE EnumType : BaseType ENUM
   * {
   *   [@enum_annot1]
   *   EnumConstant1 = EnumValue1 | INITIAL;
   *   [@enum_annot2]
   *   EnumConstant2 = EnumValue2 | INITIAL;
   *   [...]
   * }
   * | DEFINE TYPE EnumTypeStack : EnumTypeBase[;]
   *
   * Syntactically, there is no way to tell an enum stack definition
   * apart from a simple type when the ENUM keyword is omitted.
   *
   * @see https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/ABENCDS_DEFINE_ENUM_TYPE.html
   */
  enum_type_definition: ($) =>
    seq(
      repeat($.annotation),
      ...kws("define", "type"),
      field("name", $.identifier),
      ":",
      field("base_type", choice($.builtin_type, $._type_identifier)),
      kw("enum"),
      field("body", $.enum_body),
    ),

  enum_body: ($) => seq("{", repeat1($.enum_constant_definition), "}"),

  // EnumConstant1 = EnumValue1 | INITIAL;
  enum_constant_definition: ($) =>
    seq(
      repeat($.annotation),
      field("name", $.identifier),
      "=",
      field("value", choice($.literal, $.initial)),
      ";",
    ),

  initial: (_) => /initial/i,
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
