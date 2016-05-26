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

define(['recognitionstep', 'productionrule'], function(RecognitionStep, ProductionRule) {
    'use strict';

    function SentenceRecognition() {
        return this.init.apply(this, arguments);
    };

    SentenceRecognition.prototype = {
        /**
         * @param {Grammar} grammar
         * @param {SyntacticAnalysis} analysis
         * @param {PredictiveTable} table
         *
         * @constructs
         */
        init: function(grammar, analysis, table) {
            this.grammar = grammar;
            this.analysis = analysis;
            this.table = table;
            this.steps = [];
        },

        recognize: function(sentence) {
            var error = false;
            var step = new RecognitionStep([this.grammar.productionStartSymbol()], sentence + '$');
            this.steps.push(step);

            while (!step.finished() && !error) {
                var nextStep = step.clone();

                var readSymbol = this.analysis._tryReadTerminal(step.input);
                var head = nextStep.stack.pop(); // Topo da pilha

                if (this.grammar.terminalSymbols().indexOf(head) !== -1) {
                    // Topo da pilha é um símbolo terminal

                    if (head === readSymbol) {
                        step.action = 'Desempilha e lê símbolo';
                        nextStep.input = step.input.substr(readSymbol.length).trim();
                    }
                    else {
                        error = true;
                        break;
                    }
                }
                else {
                    // Topo da pilha é um símbolo não-terminal

                    var row = this.table.getRow(head);
                    var cell = row.getCell(readSymbol);

                    if (!cell || !cell.production()) {
                        error = true;
                        break;
                    }

                    nextStep.stack = nextStep.stack.concat(this.splitSymbols(cell.production()).reverse());
                    step.action = cell.representation();
                }

                step = nextStep;
                this.steps.push(step);
            }

            return !error;
        },

        /**
         * Divide os símbolos de uma sentença para um array de símbolos.
         *
         * @param {String} sentence
         * @returns {String[]}
         */
        splitSymbols: function(sentence) {
            var symbols = [];
            while (sentence && sentence !== ProductionRule.EPSILON) {
                var symbol = this.analysis._tryReadTerminal(sentence);
                if (!symbol) {
                    symbol = this.analysis._tryReadNonTerminal(sentence);
                }

                if (symbol) {
                    symbols.push(symbol);
                    sentence = sentence.substr(symbol.length).trim();
                }
            }

            return symbols;
        }
    };

    return SentenceRecognition;
});
