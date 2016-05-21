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

define(['knockout', 'productionrule', 'utils'], function(ko, ProductionRule, utils) {
    'use strict';

    /**
     * Símbolo utilizado para representar a gramática no formalismo.
     *
     * @const
     */
    var GRAMMAR_SYMBOL = 'G';

    /**
     * Indentação utilizada para as regras de produção dentro do conjunto, na
     * representação do formalismo da gramática.
     *
     * @const
     */
    var INDENT = '    ';

    /**
     * Representação de uma gramática regular ou livre de contexto.
     *
     * @class
     */
    function Grammar() {
        this.init.apply(this, arguments);
    }

    Grammar.prototype = {

        /**
         * @constructs
         *
         * @param {object} data Inicializa a gramática com as propriedades informadas nesse parâmetro.
         */
        init: function(data) {
            data = data || {};

            this.nonTerminalSymbols    = ko.observableArray(data.nonTerminalSymbols || []);
            this.terminalSymbols       = ko.observableArray(data.terminalSymbols    || []);
            this.productionSetSymbol   = ko.observable(data.productionSetSymbol     || '');
            this.productionStartSymbol = ko.observable(data.productionStartSymbol   || '');
            this.productionRules       = ko.observableArray([]);

            this.completed        = ko.pureComputed(this.isCompleted,       this);
            this.validationErrors = ko.pureComputed(this.validate,          this);
            this.formalism        = ko.pureComputed(this.toFormalismString, this);

            this.cacheFirst = {};
            this.cacheFollow = {};

            this.allFirst = ko.pureComputed(function() {
                var first = '';
                var nt = this.nonTerminalSymbols();

                for (var i = 0, l = nt.length; i < l; ++i) {
                    first += 'FIRST(' + nt[i] + ') = ';
                    first += this.first(nt[i]).join(', ');
                    first += '\n';
                }

                return first;
            }, this);

            this.allFollow = ko.pureComputed(function() {
                var follow = '';
                var nt = this.nonTerminalSymbols();

                for (var i = 0, l = nt.length; i < l; ++i) {
                    follow += 'FOLLOW(' + nt[i] + ') = ';
                    follow += this.follow(nt[i]).join(', ');
                    follow += '\n';
                }

                return follow;
            }, this);

            if (data.productionRules) {
                for (var i = 0, l = data.productionRules.length; i < l; ++i) {
                    this.productionRules.push(new ProductionRule(this, data.productionRules[i]));
                }
            }
            else {
                this.productionRules.push(new ProductionRule(this));
            }
        },

        /**
         * Verifica se a gramática é válida.
         *
         * @return {boolean} Se a gramática é válida ou não.
         */
        validate: function() {
            var err = [],
                nt  = this.nonTerminalSymbols(),
                t   = this.terminalSymbols(),
                p   = this.productionSetSymbol(),
                s   = this.productionStartSymbol(),
                r   = this.productionRules();

            // 1. Símbolos terminais e não terminais precisam ser diferentes
            var intersect = utils.arrayIntersection(nt, t);
            if (intersect.length > 0) {
                err.push('Existem símbolos não terminais repetidos entre os '
                        + 'símbolos terminais (' + intersect.join(', ') + ').');
            }

            // 2.1. Símbolo de início de produção deve ser não terminal
            if (s && nt.indexOf(s) === -1) {
                err.push('O símbolo de início de produção não está '
                        + 'entre os símbolos não terminais.');
            }

            // 2.2. Símbolo de início de produção NÃO deve ser terminal
            if (s && t.indexOf(s) > -1) {
                err.push('O símbolo de início de produção não pode '
                        + 'estar entre os símbolos terminais.');
            }

            // Validações das regras de produção
            var generators = [],
                duplicated = [];

            for (var i = 0, l = r.length; i < l; ++i) {
                var left = r[i].leftSide();
                if (left) {
                    if (generators.indexOf(left) !== -1 && duplicated.indexOf(left) === -1) {
                        duplicated.push(left);
                    }
                    else {
                        generators.push(left);
                    }
                }
            }

            // 3. Deve haver uma produção para o símbolo de início de produção
            if (s && generators.indexOf(s) === -1) {
                err.push('Não existe nenhuma produção para o símbolo de início de produção.');
            }

            // 4. Não deve existir mais de uma produção para o mesmo símbolo
            if (duplicated.length > 0) {
                err.push('Existem produções duplicadas (' + duplicated.join(', ') + ').');
            }

            // Retorna a lista de erros de validação.
            return err;
        },

        /**
         * Monta a string que representa o formalismo da gramática, incluindo
         * o conjunto de regras de produção.
         *
         * @return {string} A representação formal da gramática.
         */
        toFormalismString: function() {
            var nt = this.nonTerminalSymbols().join(', '),
                t  = this.terminalSymbols()   .join(', '),
                p  = this.productionSetSymbol(),
                s  = this.productionStartSymbol(),
                pr = [];

            var rules = this.productionRules(), f;
            for (var i = 0, l = rules.length; i < l; ++i) {
                f = rules[i].toFormalismString();
                if (f) {
                    pr.push(INDENT + f);
                }
            }

            if (nt && t && p && s && pr.length) {
                return GRAMMAR_SYMBOL + ' = ({' + nt + '}, {' + t + '}, ' + p + ', ' + s + ')\n'
                        + p + ' = {\n' + pr.join(',\n') + '\n}';
            }

            return '';
        },

        /**
         * Verifica a qual classe a gramática que foi definida pertence através da análise do formato das regras de
         * produção criadas.
         *
         * @return {string} O nome da classe à qual a gramática pertence.
         */
        isContextFree: function() {
            var rules = this.productionRules();

            for (var i = 0, l = rules.length; i < l; ++i) {
                if (!rules[i].isContextFree()) {
                    return false;
                }
            }

            return true;
        },

        /**
         * Adiciona uma nova regra de produção à gramática.
         *
         * @param {object} data Dados para inicializar a regra de produção.
         */
        addProductionRule: function(data) {
            this.productionRules.push(new ProductionRule(this, data));
        },

        /**
         * Remove uma regra anteriormente adicionada à gramática.
         *
         * @param {ProductionRule} rule Regra de produção para ser removida.
         */
        removeRule: function(rule) {
            var rules = this.productionRules();
            for (var i = 0, l = rules.length; i < l; ++i) {
                if (rule === rules[i]) {
                    this.productionRules.splice(i, 1);
                    break;
                }
            }
        },

        removeSymbolRules: function(symbols) {
            if (typeof symbols === 'string') {
                symbols = [symbols];
            }

            var rules = this.productionRules();
            for (var i = 0, l = rules.length; i < l; ++i) {
                if (symbols.indexOf(rules[i].leftSide()) !== -1) {
                    rules.splice(i--, 1);
                    --l;
                }
            }
            this.productionRules(rules);
        },

        /**
         * Cria um novo símbolo não terminal único, adicionando apóstrofos para garantir que o símbolo não é repetido.
         *
         * @param {string} base Símbolo base para ser utilizado. Serão adicionados apóstrofos nesse símbolo.
         * @returns {string} O símbolo criado.
         */
        createNonTerminalSymbol: function(base) {
            var symbol = base;

            // Evita símbolos repetidos adicionando apóstrofos ao símbolo
            while (this.nonTerminalSymbols.indexOf(symbol) !== -1) {
                symbol += "'";
            }

            this.nonTerminalSymbols.push(symbol);
            return symbol;
        },

        /**
         * Verifica se a definição da gramática está completa (todas as informações inseridas).
         *
         * @return {boolean} Se a gramática está completamente definida.
         */
        isCompleted: function() {
            var completed = true,
                rules = this.productionRules();

            completed &= this.nonTerminalSymbols()   .length > 0;
            completed &= this.terminalSymbols()      .length > 0;
            completed &= this.productionSetSymbol()  .length > 0;
            completed &= this.productionStartSymbol().length > 0;
            completed &= this.productionRules()      .length > 0;

            for (var i = 0, l = rules.length; i < l; ++i) {
                completed &= rules[i].isCompleted();
            }

            return completed;
        },

        /**
         * Procura as possíveis produções para um determinado símbolo.
         *
         * @param {string} symbol Símbolo para o qual buscar as produções.
         * @returns {string[]} Conjunto das produções desse símbolo, ou null se o símbolo não possui produções.
         */
        getProductions: function(symbol) {
            var rules = this.productionRules();
            for (var i = 0, l = rules.length; i < l; ++i) {
                if (rules[i].leftSide() === symbol) {
                    return rules[i].rightSide();
                }
            }
            return [];
        },

        first: function(symbol) {
            if (typeof this.cacheFirst[symbol] !== 'undefined') {
                return this.cacheFirst[symbol];
            }

            var right = this.getProductions(symbol);
            var t = this.terminalSymbols();
            var nt = this.nonTerminalSymbols();
            var first = [];

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

            var rules = this.productionRules();
            var follow = [];

            if (symbol === this.productionStartSymbol()) {
                follow.push('$');
            }

            // Percorre todas as regras de produção da gramática
            for (var i = 0, l = rules.length; i < l; ++i) {
                var left = rules[i].leftSide();
                var prods = rules[i].rightSide();

                for (var j = 0, m = prods.length; j < m; ++j) {
                    var idx = prods[j].indexOf(symbol);

                    if (idx !== -1) {
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
                        var nonTerminal = this._tryReadNonTerminal(prods[j].substr(idx + 1));
                        if (nonTerminal !== false) {
                            follow = follow.concat(this.first(left));
                            continue;
                        }
                    }
                }
            }

            follow = utils.arrayUnique(follow);

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
            return this._tryReadSymbol(string, this.terminalSymbols());
        },

        /**
         * Tenta ler um símbolo não-terminal da gramática do começo de `string`.
         *
         * @param {string} string String para realizar a leitura.
         * @returns {string|boolean} Retorna o símbolo lido, ou false se não for um símbolo não-terminal.
         */
        _tryReadNonTerminal: function(string) {
            return this._tryReadSymbol(string, this.nonTerminalSymbols());
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
            for (var i = 0, l = symbols.length; i < l; ++i) {
                if (utils.stringStartsWith(string, symbols[i])) {
                    return symbols[i];
                }
            }

            return false;
        },

        toJSON: function() {
            return {
                nonTerminalSymbols   : this.nonTerminalSymbols,
                terminalSymbols      : this.terminalSymbols,
                productionSetSymbol  : this.productionSetSymbol,
                productionStartSymbol: this.productionStartSymbol,
                productionRules      : this.productionRules
            };
        }

    };

    return Grammar;
});
