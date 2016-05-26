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

define(['knockout', 'utils', 'productionrule', 'predictivetable'], function(ko, utils, ProductionRule, PredictiveTable) {
    'use strict';

    function SyntacticAnalysis() {
        return this.init.apply(this, arguments);
    }

    SyntacticAnalysis.prototype = {
        init: function(grammar) {
            this.grammar = grammar;
            this.cacheFirst = {};
            this.cacheFollow = {};

            this.error = ko.observable();
            this.predictiveTable = ko.computed(function() {
                try {
                    return this.getPredictiveTable();
                }
                catch (e) {
                    this.error(e.message);
                }
            }, this);

            this.firstAllSymbols = ko.pureComputed(function() {
                var first = '';
                var nt = this.grammar.nonTerminalSymbols();

                for (var i = 0, l = nt.length; i < l; ++i) {
                    first += 'FIRST(' + nt[i] + ') = ';
                    first += this.first(nt[i]).join(', ');
                    first += '\n';
                }

                return first;
            }, this);

            this.followAllSymbols = ko.pureComputed(function() {
                var follow = '';
                var nt = this.grammar.nonTerminalSymbols();

                for (var i = 0, l = nt.length; i < l; ++i) {
                    follow += 'FOLLOW(' + nt[i] + ') = ';
                    follow += this.follow(nt[i]).join(', ');
                    follow += '\n';
                }

                return follow;
            }, this);
        },

        firstFromSentence: function(sentence) {
            var symbol = this._tryReadTerminal(sentence);
            if (symbol) {
                return [symbol];
            }

            symbol = this._tryReadNonTerminal(sentence);
            if (symbol) {
                return this.first(symbol);
            }

            return false;
        },

        first: function(symbol) {
            if (typeof this.cacheFirst[symbol] !== 'undefined') {
                return this.cacheFirst[symbol];
            }

            var right = this.grammar.getProductions(symbol);
            var t = this.grammar.terminalSymbols();
            var nt = this.grammar.nonTerminalSymbols();
            var first = this.cacheFirst[symbol] = [];

            // Para cada produção do símbolo especificado:
            for (var i = 0, l = right.length; i < l; ++i) {
                // Se a produção é a sentença vazia, adiciona ela ao FIRST
                if (right[i] === ProductionRule.EPSILON) {
                    first.push(ProductionRule.EPSILON);
                    continue;
                }

                // Se começa com um símbolo terminal, adiciona esse terminal ao FIRST
                for (var j = 0, m = t.length; j < m; ++j) {
                    if (utils.stringStartsWith(right[i], t[j])) {
                        // Produção começa com esse terminal, adiciona ao FIRST
                        first.push(t[j]);
                        break;
                    }
                }

                // Se não começa com um símbolo terminal, deve pegar o FIRST do NT do começo da produção
                if (j >= m) {
                    for (j = 0, m = nt.length; j < m; ++j) {
                        if (utils.stringStartsWith(right[i], nt[j])) {
                            // Encontrou o NT do começo dessa produção, então:
                            // - se não for o mesmo da produção atual, busca o FIRST dele
                            if (nt[j] !== symbol) {
                                first = first.concat(this.first(nt[j]));
                            }
                            break;
                        }
                    }
                }
            }

            first = utils.arrayUnique(first);

            this.cacheFirst[symbol] = first;
            return first;
        },

        follow: function(symbol) {
            if (typeof this.cacheFollow[symbol] !== 'undefined') {
                return this.cacheFollow[symbol];
            }

            var rules = this.grammar.productionRules();
            var follow = this.cacheFollow[symbol] = [];

            if (symbol === this.grammar.productionStartSymbol()) {
                follow.push('$');
            }

            // Percorre todas as regras de produção da gramática
            for (var i = 0, l = rules.length; i < l; ++i) {
                var left = rules[i].leftSide();
                var prods = rules[i].rightSide();

                for (var j = 0, m = prods.length; j < m; ++j) {
                    var idx = prods[j].indexOf(symbol);

                    if (idx !== -1) {

                        // FIX para não pegar símbolos que tenham o começo igual, p. ex. T' quando só deveria pegar T
                        if (this._tryReadNonTerminal(prods[j].substr(idx)) !== symbol) {
                            continue;
                        }

                        // Encontrou o símbolo não-terminal procurado nessa produção

                        // Se está no final da produção, pega o FOLLOW do símbolo que o gerou
                        if ((idx + symbol.length === prods[j].length) && (symbol !== left)) {
                            follow = follow.concat(this.follow(left));
                            continue;
                        }

                        // Se é seguido de um terminal, adiciona esse terminal ao FOLLOW
                        var terminal = this._tryReadTerminal(prods[j].substr(idx + 1));
                        if (terminal !== false) {
                            follow.push(terminal);
                            continue;
                        }

                        // Se é seguido de um não-terminal, pega o FIRST desse não-terminal
                        // - se o FIRST do NT contiver a sentença vazia, continua testando o resto da produção
                        // - se chegar no final da produção com a sentença vazia, adiciona o FOLLOW do lado esquerdo
                        var nonTerminal = this._tryReadNonTerminal(prods[j].substr(idx + 1));
                        while (nonTerminal !== false) {
                            var firstNextNT = this.first(nonTerminal);
                            follow = follow.concat(firstNextNT);

                            if (firstNextNT.indexOf(ProductionRule.EPSILON) !== -1) {
                                nonTerminal = this._tryReadNonTerminal(prods[j].substr(idx += 1 + nonTerminal.length));
                            }
                            else {
                                break;
                            }
                        }

                        if ((idx >= prods[j].length) && (symbol !== left)) {
                            follow = follow.concat(this.follow(left));
                        }
                    }
                }
            }

            follow = utils.arrayRemove(utils.arrayUnique(follow), [ProductionRule.EPSILON]);

            this.cacheFollow[symbol] = follow;
            return follow;
        },

        /**
         * Tenta ler um símbolo terminal da gramática do começo de `string`.
         *
         * @param {string} string String para realizar a leitura.
         * @returns {string|boolean} Retorna o símbolo lido, ou false se não for um símbolo terminal.
         */
        _tryReadTerminal: function(string) {
            return this._tryReadSymbol(string, this.grammar.terminalSymbols());
        },

        /**
         * Tenta ler um símbolo não-terminal da gramática do começo de `string`.
         *
         * @param {string} string String para realizar a leitura.
         * @returns {string|boolean} Retorna o símbolo lido, ou false se não for um símbolo não-terminal.
         */
        _tryReadNonTerminal: function(string) {
            return this._tryReadSymbol(string, this.grammar.nonTerminalSymbols());
        },

        /**
         * Tenta ler um símbolo do conjunto de `symbols` do começo de `string`. Se `string` não começar com nenhum dos
         * símbolos aceitos, é retornado `false`.
         *
         * @param {string} string String que deve ser lida.
         * @param {string[]} symbols Símbolos aceitos para leitura no começo da string.
         * @returns {string|boolean} Retorna o símbolo lido, ou false se não for um símbolo aceito.
         */
        _tryReadSymbol: function(string, symbols) {
            var symbolsSorted = utils.sortArrayLongestFirst(symbols);

            for (var i = 0, l = symbolsSorted.length; i < l; ++i) {
                if (utils.stringStartsWith(string, symbolsSorted[i])) {
                    return symbolsSorted[i];
                }
            }

            return false;
        },

        getPredictiveTable: function() {
            var table = new PredictiveTable(this.grammar);
            var prods = this.grammar.productionRules();

            for (var i = 0, l = prods.length; i < l; ++i) {
                var left = prods[i].leftSide();
                var right = prods[i].rightSide();

                for (var j = 0, m = right.length; j < m; ++j) {
                    var symbols;

                    if (right[j] === ProductionRule.EPSILON) {
                        symbols = this.follow(left);
                    }
                    else {
                        symbols = this.firstFromSentence(right[j]);
                    }

                    for (var k = 0, n = symbols.length; k < n; ++k) {
                        if (table.getRow(left).getCell(symbols[k]).production()) {
                            throw new Error('Gramática é ambígua!');
                        }
                        table.setCell(left, symbols[k], left, right[j]);
                    }
                }
            }

            return table;
        }

    };

    return SyntacticAnalysis;
});
