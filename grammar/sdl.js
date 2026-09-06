/**
 * @file CDS Service Definition Language (SDL) rules
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

export const serviceDefinitionRules = {
  /*
   * [@service_annot1]
   * [@service_annot2]
   * ...
   * [DEFINE] SERVICE service
   * [PROVIDER CONTRACTS contract]
   * {
   *    EXPOSE cds_entity [AS alias];
   *  / EXPOSE METHOD class_name=>method_name AS alias;
   *    ...
   * }
   *
   * @see https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/ABENSRVD_DEFINE_SERVICE.html
   */
  service_definition: ($) =>
    seq(
      repeat($.annotation),
      optional(kw("define")),
      kw("service"),
      field("name", $.identifier),
      optional(field("contract", $.provider_contracts)),
      field("body", $.exposed_service_objects),
    ),

  exposed_service_objects: ($) =>
    seq("{", repeat1(choice($.exposed_entity, $.exposed_method)), "}"),

  // EXPOSE cds_entity [AS alias];
  exposed_entity: ($) =>
    seq(kw("expose"), field("name", $.identifier), optional($.alias), ";"),

  // EXPOSE METHOD class=>method AS alias;
  exposed_method: ($) =>
    seq(
      ...kws("expose", "method"),
      field("name", $.method_qualifier),
      $.alias,
      ";",
    ),

  alias: ($) => seq(kw("as"), field("name", $.identifier)),

  method_qualifier: ($) =>
    seq(
      field("class", $.identifier),
      token.immediate("=>"),
      field("name", $._immediate_identifier),
    ),

  /*
   * ... PROVIDER CONTRACTS INA | ODATA_V2_UI  ...
   *
   * The specific scenarion is simply parsed as identifier to be more
   * permissive and not add constants going forward.
   *
   * @see https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/ABENSRVD_PROVIDER_CONTRACT.html
   */
  provider_contracts: ($) =>
    seq(...kws("provider", "contracts"), field("scenario", $.identifier)),
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
