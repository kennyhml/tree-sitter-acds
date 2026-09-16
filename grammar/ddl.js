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

  /* [@entity_annot1]
   * [@entity_annot2]
   * ...
   * [@view_entity_annot1]
   * [@view_entity_annot2]
   * ...
   * [DEFINE] [WRITABLE] [ROOT] VIEW ENTITY view_entity
   *    [parameter_list]
   *    as select_statement[;]...
   *
   * @see https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/ABENCDS_DEFINE_VIEW_ENTITY.html
   */
  view_entity_definition: ($) =>
    seq(
      repeat($.annotation),
      optional(kw("define")),
      optional(kw("writable")),
      optional(kw("root")),
      ...kws("view", "entity"),
      field("name", $.identifier),
      optional(field("parameters", $.view_parameters)),
      field("query", $.view_query),
      optional(";"),
    ),

  /*
   * ... WITH PARAMETERS parameter1, parameter2...
   *
   * @see https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/ABENCDS_PARAMETER_LIST_V2.html
   */
  view_parameters: ($) =>
    seq(...kws("with", "parameters"), commaSep1($.view_parameter)),

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
      repeat($.annotation),
      field("name", $.identifier),
      ":",
      field("type", choice($._type_identifier, $.builtin_type)),
      // TODO: Trailing @< annotations conflict with the next parameter's annotations.
    ),

  /*
   * SELECT [DISTINCT] FROM data_source
   *        [association1 association2 ...]
   *        [aspect binding]
   *            {select_list}
   *        [clauses]
   *
   * @see https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/ABENCDS_SELECT_STATEMENT_V2.html
   */
  view_query: ($) =>
    seq(
      ...kws("as", "select"),
      optional(kw("distinct")),
      kw("from"),
      field("source", $.data_source),
      optional(field("associations", $.associations)),
      field("elements", $.view_element_list),

      optional(field("where", $.where_clause)),
    ),

  /*
   * ... { element1; element2; ... }
   *
   * @see https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/ABENCDS_TABLE_ENTITY_ELEMENT_LIST.html
   */
  table_element_list: ($) => seq("{", repeat1($.table_element), "}"),

  /*
   * ... { element1, element2, ... } ...
   *
   * @see https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/ABENCDS_VIEW_ENTITY_ELEMENT_LIST_V2.html
   */
  view_element_list: ($) => seq("{", commaSep1($.view_element), "}"),

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
          field(
            "navigation",
            choice($.association, $.to_parent_association, $.composition),
          ),
        ),
      ),
      ";",
    ),

  /*
   * ... [@element_annot1]
   *     [@element_annot2]
   *     ...
   *     [KEY] { field                     [AS alias] }
   *         | { include aspect            [AS alias] }
   *         | { expose_assoc              [AS alias] }
   *         | { path_expr.element         [AS alias] }
   *         | { literal                    AS alias  }
   *         | { parameter                  AS alias  }
   *         | { session_variable           AS alias  }
   *         | { aggr_expr                  AS alias  }
   *         | { arith_expr                 AS alias  }
   *         | { builtin_func               AS alias  }
   *         | { SQL-based scalar function  AS alias  }
   *         | { reuse_exp                  AS alias  }
   *         | { case_expr                  AS alias  }
   *         | { cast_expr                  AS alias  }
   *         | { EnumConstant               AS alias  }
   *     ...
   * }
   *
   * @see https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/ABENCDS_VIEW_ENTITY_ELEMENT.html
   */
  view_element: ($) =>
    seq(
      repeat($.annotation),
      optional(kw("key")),
      choice(
        seq(
          field("field", choice($.qualified_field, $.identifier)),
          optional(field("alias", $.alias)),
        ),
        seq(
          field("value", choice($.literal, $.parameter_ref)),
          field("alias", $.alias),
        ),
      ),
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
