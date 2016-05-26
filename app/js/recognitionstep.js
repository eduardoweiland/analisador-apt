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

define(['knockout'], function(ko) {
    'use strict';

    function RecognitionStep() {
        return this.init.apply(this, arguments);
    };

    RecognitionStep.prototype = {
        /**
         * @constructs
         */
        init: function(stack, input, action) {
            this.stack = stack || [];
            this.input = input || '$';
            this.action = action || '';

            this.stackDisplay = ko.pureComputed(function() {
                return '$ ' + this.stack.join(' ');
            }, this);
        },

        clone: function() {
            var _clone = new RecognitionStep();
            _clone.stack = this.stack.slice();
            _clone.input = this.input;
            _clone.action = this.action;

            return _clone;
        },

        finished: function() {
            return (this.stack.length === 0 && this.input === '$');
        }
    };

    return RecognitionStep;
});
