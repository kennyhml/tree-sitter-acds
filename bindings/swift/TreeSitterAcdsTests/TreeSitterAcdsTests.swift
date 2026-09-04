import XCTest
import SwiftTreeSitter
import TreeSitterAcds

final class TreeSitterAcdsTests: XCTestCase {
    func testCanLoadGrammar() throws {
        let parser = Parser()
        let language = Language(language: tree_sitter_acds())
        XCTAssertNoThrow(try parser.setLanguage(language),
                         "Error loading ABAP CDS grammar")
    }
}
