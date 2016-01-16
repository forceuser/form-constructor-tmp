function FormConstructor(){
    return this.initialize.apply(this,arguments);
}

window.FormConstructor = FormConstructor;

FormConstructor.saveBlob = function (blob, filename) {
        if(window.navigator.msSaveOrOpenBlob) {
            window.navigator.msSaveBlob(blob, filename);
        }else{
            var a = document.createElement("a");
            var url = window.URL.createObjectURL(blob);
            
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);  
            window.URL.revokeObjectURL(url);
        }
    };
};
FormConstructor.saveText = function(text,fileName){
        var blob = new Blob([text], {type: 'text/plain'});
        this.saveBlob(blob,fileName)
    };
FormConstructor.loadFile = function(file){
        var fr = new FileReader();
        var res = $.Deferred();
        fr.onload = function(e){
            res.resolve(e.target.result);
        };
        fr.readAsText(file);
        return res;
    };
    

FormConstructor.prototype = {
    constructor: FormConstructor.constructor,
    add: function(name, value) {
        var self = this;
        var input = this.dom.form.find('input[name="' + name + '"]');
        if (!input.length) {
            input = $('<input name="' + name + '" type="hidden" />');
            this.dom.form.append(input);
        }
        if (value === null || typeof value === 'undefined') {
            input.remove();
        }
        else {
            input.val(value);
        }
        return this;
    },
    get: function(name) {
        var input = this.dom.form.find('input[name="' + name + '"]');
        return input.val();
    },
    addFile: function(name, miltiple, accept) {
        var self = this;
        var input;
        var def = $.Deferred();
        var checker = {
            next: function() {
                return self;
            },
            check: function(callback, errback) {
                checker.callback = callback;
                checker.errback = errback;
                return self;
            }
        };
        self.wait.push(def);
        input = this.dom.form.find('input[name="' + name + '"]');
        if (!input.length) {
            input = $('<input name="' + name + '" type="file" />');
            this.dom.form.append(input);
        }

        if (accept) {
            input.attr("accept", accept);
        }
        else {
            input.removeAttr("accept");
        }
        if (miltiple) {
            input.attr("multiple", "multiple");
        }
        else {
            input.removeAttr("multiple");
        }
        input.on("change", function() {
            self.wait.splice(self.wait.indexOf(def), 1);
            var result = true,
                error;
            if (checker.callback) {
                try {
                    result = checker.callback.call(self, {
                        name: name,
                        files: input[0].files
                    });
                }
                catch (e) {
                    error = e;
                    result = false;
                }

                if (result === false) {
                    input.val("");
                    checker.errback && checker.errback.call(self, {
                        name: name,
                        files: input[0].files,
                        error: error
                    });
                }
            }

            if (result) {
                def.resolve();
            }
            else {
                def.reject(error && error);
            }
        });

        input.click();
        return checker;
    },
    clear: function(name) {
        if (name) {
            this.dom.form.find('input[name="' + name + '"]').remove();
        }
        else {
            this.dom.form.find('input').remove();
        }
    },
    open: function(url, target, method) {
        var self = this;
        var wnd;
        self.dom.form[0].method = (method || self.method || "post").toLowerCase();
        self.dom.form[0].target = target || '_self';
        self.dom.form[0].action = url || self.url;

        if (self.dom.form[0].target !== "_self") {
            if (self.dom.form[0].target === "_blank") {
                self.dom.form[0].target = Math.random().toString(36).slice(2);
            }
            wnd = window.open("", self.dom.form[0].target);
        }
        else {
            wnd = window;
        }
        self.dom.form[0].submit();
        return wnd;
    },
    submit: function(url, method, beforeCallback) {
        var self = this;
        var res = $.Deferred();
        var args = Array.apply(null, arguments);
        if (self.wait.length > 0) {
            return  $.when.apply($, self.wait||[]).then(function() {
                return self.submit.apply(self, args);
            }, function(e) {
                res.reject(e);
                return res.promise;
            });
        }
        if (window.FormData) {
            var formdata = new FormData();
            try {
                Array.apply(null,self.dom.form[0].elements).forEach(function(input) {
                    if (input.type === "file") {
                        Array.apply(null,input.files).forEach(function(file) {
                            formdata.append(input.name + (input.multiple ? '[]' : ''), file);
                        });
                    }
                    else {
                        formdata.append(input.name, input.value);
                    }
                });
            }
            catch (e) {
                console.dir(e);
            }
            beforeCallback && beforeCallback(self);

            $.ajax({
                method: method || self.method || "POST",
                url: url || self.url || '',
                data: formdata,
                headers: $.extend({
                    'Content-Type': undefined
                }, self.headers)
            }).then(
                function(response) {
                    try {
                        res.resolve(response);
                    }
                    catch (e) {

                    }
                    finally {
                        //                            self.dom.iframe.remove();
                        //                            self.dom.form.remove();
                    }
                },
                function(response) {
                    try {
                        res.reject(response);
                    }
                    catch (e) {

                    }
                    finally {
                        //                            self.dom.iframe.remove();
                        //                            self.dom.form.remove();
                    }
                }
            );
        }
        else {
            self.dom.iframe.on("load", function(e) {
                console.log("iframe", e);
                var data;
                var dataType = "json";
                try {
                    try {
                        var json = $((self.dom.iframe.contentDocument && self.dom.iframe.contentDocument.body) || "").text().replace(/^"|"$/g, "").replace(/^\s+|"\s+/g, "");
                        data = JSON.parse(json);
                    }
                    catch (e) {
                        dataType = "text";
                        data = (self.dom.iframe[0].contentDocument && self.dom.iframe[0].contentDocument.body.innerHTML) || "";
                    }
                }
                catch (e) {

                }

                res.resolve({
                    data: data
                });
            });
            self.dom.form[0].method = (method || self.method || "post").toLowerCase();
            self.dom.form[0].target = self.dom.iframe[0].id;
            self.dom.form[0].action = url || self.url || "";
            self.dom.form.submit();
        }
        return res.promise;
    },
    initialize: function(options) {
        options = $.extend({}, options);
        this.wait = [];
        this.options = options;
        var self = this;
        this.dom = {};
        this.frameName = 'uploader' + (new Array(10).join().replace(/(.|$)/g, function() {
            return ((Math.random() * 36) | 0).toString(36)[Math.random() < .5 ? "toString" : "toUpperCase"]();
        }));
        this.dom = {
            form: $(
                '<form enctype="multipart/form-data" encoding="multipart/form-data" accept-charset="UTF-8" method="post" target="' + this.frameName + '" style="display:none;">' +
                '<button type="submit"></button>' +
                '</form>'
            ),
            iframe: $(
                '<iframe id="' + this.frameName + '" name="' + this.frameName + '" style="display:none;"></iframe>'
            )
        };

        $("body").append(this.dom.iframe[0]);
        $("body").append(this.dom.form[0]);

        if (options.url) {
            this.url = options.url;
        }
        if (options.method) {
            this.method = options.method;
        }
    }
};
