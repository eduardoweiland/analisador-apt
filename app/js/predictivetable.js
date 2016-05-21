/*
 * The MIT License
 *
 * Copyright 2015 Eduardo Weiland.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

define(['knockout', 'productionrule'], function(ko, ProductionRule) {
    'use strict';

    function PredictiveTableCell() {
        this.init.apply(this, arguments);
    }

    PredictiveTableCell.prototype = {
        init: function(symbol, nt, prod) {
            this.symbol = ko.observable(symbol || '');
            this.generator = ko.observable(nt || '');
            this.production = ko.observable(prod || '');

            this.representation = ko.pureComputed(function() {
                var generator = this.generator();
                var production = this.production();

                if (generator && production) {
                    return generator + ' ' + ProductionRule.ARROW + ' ' + production;
                }

                return '';
            }, this);
        }
    };

    function PredictiveTableRow() {
        this.init.apply(this, arguments);
    }

    PredictiveTableRow.prototype = {
        init: function(header) {
            this.header = ko.observable(header);
            this.cells = ko.observableArray();
        },

        addCell: function(symbol, nt, prod) {
            this.cells.push(new PredictiveTableCell(symbol, nt, prod));
        },

        getCell: function(symbol) {
            var cells = this.cells();

            for (var i = 0, l = cells.length; i < l; ++i) {
                if (cells[i].symbol() === symbol) {
                    return cells[i];
                }
            }

            return null;
        }
    };

    /**
     * Representação de uma tabela sintática preditiva.
     *
     * @class
     */
    function PredictiveTable() {
        this.init.apply(this, arguments);
    }

    PredictiveTable.END_OF_INPUT = '$';

    PredictiveTable.prototype = {
        /**
         * @constructs
         */
        init: function(grammar) {
            this.columns = grammar.terminalSymbols();
            this.columns.push(PredictiveTable.END_OF_INPUT);

            var nt = grammar.nonTerminalSymbols();
            this.rows = [];

            for (var i = 0, l = nt.length; i < l; ++i) {
                var row = new PredictiveTableRow(nt[i]);

                for (var j = 0, m = this.columns.length; j < m; ++j) {
                    row.addCell(this.columns[j]);
                }

                this.rows.push(row);
            }
        },

        getRow: function(header) {
            for (var i = 0, l = this.rows.length; i < l; ++i) {
                if (this.rows[i].header() === header) {
                    return this.rows[i];
                }
            }

            return null;
        },

        setCell: function(nonTerminal, terminal, generator, production) {
            var row = this.getRow(nonTerminal);
            if (row) {
                var cell = row.getCell(terminal);
                if (cell) {
                    cell.generator(generator);
                    cell.production(production);
                }
            }
        }
    };

    return PredictiveTable;
});
