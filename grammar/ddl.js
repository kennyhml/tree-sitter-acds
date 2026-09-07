/**
 * @file CDS Data Definition Language (DDL) rules
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

/** @type {RuleBuilders<string, never>} */
export const dataDefinitionRules = {
  /* [@entity_annot1]
   * [@entity_annot2]
   * ...
   * [@table_entity_annot1]
   * [@table_entity_annot2]
   * ...
   * [DEFINE] [ROOT] TABLE ENTITY table_entity
   *    element_list[;]
   *
   * @see https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/ABENCDS_DEFINE_TABLE_ENTITY.html
   */
  table_entity_definition: ($) =>
    seq(
      repeat($.annotation),
      optional(kw("define")),
      optional(kw("root")),
      ...kws("table", "entity"),
      field("name", $.identifier),
      field("elements", $.table_element_list),
      optional(";"),
    ),

  /*
   * ... { element1; element2; ... }
   *
   * @see https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/ABENCDS_TABLE_ENTITY_ELEMENT_LIST.html
   */
  table_element_list: ($) => seq("{", repeat1($.table_element), "}"),

  /*
   * ... [@element_annot1]
   *     [@element_annot2]
   *     ...
   *     { [KEY] name      : typing [NULL]; }
   *   | {      _assoc     : association; }
   *   | {      _compos    : composition; }
   *   | {      _to_parent : association to parent; }
   *
   * @see https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/ABENCDS_TABLE_ENTITY_ELEMENT.html
   */
  table_element: ($) =>
    seq(
      repeat($.annotation),
      choice(
        seq(
          optional(kw("key")),
          field("name", $.identifier),
          ":",
          field("type", choice($._type_identifier, $.builtin_type)),
          optional(kw("null")),
        ),
        seq(
          field("name", $.identifier),
          ":",
          field("navigation", choice($.association, $.to_parent_association)),
        ),
      ),
      ";",
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
