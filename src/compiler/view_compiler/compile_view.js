'use strict';"use strict";
var lang_1 = require('angular2/src/facade/lang');
var collection_1 = require('angular2/src/facade/collection');
var o = require('../output/output_ast');
var constants_1 = require('./constants');
var compile_query_1 = require('./compile_query');
var compile_method_1 = require('./compile_method');
var compile_pipe_1 = require('./compile_pipe');
var view_type_1 = require('angular2/src/core/linker/view_type');
var compile_metadata_1 = require('../compile_metadata');
var util_1 = require('./util');
var identifiers_1 = require('../identifiers');
var CompileView = (function () {
    function CompileView(component, genConfig, pipeMetas, styles, viewIndex, declarationElement, templateVariableBindings) {
        var _this = this;
        this.component = component;
        this.genConfig = genConfig;
        this.pipeMetas = pipeMetas;
        this.styles = styles;
        this.viewIndex = viewIndex;
        this.declarationElement = declarationElement;
        this.templateVariableBindings = templateVariableBindings;
        this.nodes = [];
        // root nodes or AppElements for ViewContainers
        this.rootNodesOrAppElements = [];
        this.bindings = [];
        this.classStatements = [];
        this.eventHandlerMethods = [];
        this.fields = [];
        this.getters = [];
        this.disposables = [];
        this.subscriptions = [];
        this.purePipes = new Map();
        this.pipes = [];
        this.locals = new Map();
        this.literalArrayCount = 0;
        this.literalMapCount = 0;
        this.pipeCount = 0;
        this.createMethod = new compile_method_1.CompileMethod(this);
        this.injectorGetMethod = new compile_method_1.CompileMethod(this);
        this.updateContentQueriesMethod = new compile_method_1.CompileMethod(this);
        this.dirtyParentQueriesMethod = new compile_method_1.CompileMethod(this);
        this.updateViewQueriesMethod = new compile_method_1.CompileMethod(this);
        this.detectChangesInInputsMethod = new compile_method_1.CompileMethod(this);
        this.detectChangesRenderPropertiesMethod = new compile_method_1.CompileMethod(this);
        this.afterContentLifecycleCallbacksMethod = new compile_method_1.CompileMethod(this);
        this.afterViewLifecycleCallbacksMethod = new compile_method_1.CompileMethod(this);
        this.destroyMethod = new compile_method_1.CompileMethod(this);
        this.viewType = getViewType(component, viewIndex);
        this.className = "_View_" + component.type.name + viewIndex;
        this.classType = o.importType(new compile_metadata_1.CompileIdentifierMetadata({ name: this.className }));
        this.viewFactory = o.variable(util_1.getViewFactoryName(component, viewIndex));
        if (this.viewType === view_type_1.ViewType.COMPONENT || this.viewType === view_type_1.ViewType.HOST) {
            this.componentView = this;
        }
        else {
            this.componentView = this.declarationElement.view.componentView;
        }
        this.componentContext =
            util_1.getPropertyInView(o.THIS_EXPR.prop('context'), this, this.componentView);
        var viewQueries = new compile_metadata_1.CompileTokenMap();
        if (this.viewType === view_type_1.ViewType.COMPONENT) {
            var directiveInstance = o.THIS_EXPR.prop('context');
            collection_1.ListWrapper.forEachWithIndex(this.component.viewQueries, function (queryMeta, queryIndex) {
                var propName = "_viewQuery_" + queryMeta.selectors[0].name + "_" + queryIndex;
                var queryList = compile_query_1.createQueryList(queryMeta, directiveInstance, propName, _this);
                var query = new compile_query_1.CompileQuery(queryMeta, queryList, directiveInstance, _this);
                compile_query_1.addQueryToTokenMap(viewQueries, query);
            });
            var constructorViewQueryCount = 0;
            this.component.type.diDeps.forEach(function (dep) {
                if (lang_1.isPresent(dep.viewQuery)) {
                    var queryList = o.THIS_EXPR.prop('declarationAppElement')
                        .prop('componentConstructorViewQueries')
                        .key(o.literal(constructorViewQueryCount++));
                    var query = new compile_query_1.CompileQuery(dep.viewQuery, queryList, null, _this);
                    compile_query_1.addQueryToTokenMap(viewQueries, query);
                }
            });
        }
        this.viewQueries = viewQueries;
        templateVariableBindings.forEach(function (entry) { _this.locals.set(entry[1], o.THIS_EXPR.prop('context').prop(entry[0])); });
        if (!this.declarationElement.isNull()) {
            this.declarationElement.setEmbeddedView(this);
        }
    }
    CompileView.prototype.callPipe = function (name, input, args) {
        var compView = this.componentView;
        var pipe = compView.purePipes.get(name);
        if (lang_1.isBlank(pipe)) {
            pipe = new compile_pipe_1.CompilePipe(compView, name);
            if (pipe.pure) {
                compView.purePipes.set(name, pipe);
            }
            compView.pipes.push(pipe);
        }
        return pipe.call(this, [input].concat(args));
    };
    CompileView.prototype.getLocal = function (name) {
        if (name == constants_1.EventHandlerVars.event.name) {
            return constants_1.EventHandlerVars.event;
        }
        var currView = this;
        var result = currView.locals.get(name);
        while (lang_1.isBlank(result) && lang_1.isPresent(currView.declarationElement.view)) {
            currView = currView.declarationElement.view;
            result = currView.locals.get(name);
        }
        if (lang_1.isPresent(result)) {
            return util_1.getPropertyInView(result, this, currView);
        }
        else {
            return null;
        }
    };
    CompileView.prototype.createLiteralArray = function (values) {
        if (values.length === 0) {
            return o.importExpr(identifiers_1.Identifiers.EMPTY_ARRAY);
        }
        var proxyExpr = o.THIS_EXPR.prop("_arr_" + this.literalArrayCount++);
        var proxyParams = [];
        var proxyReturnEntries = [];
        for (var i = 0; i < values.length; i++) {
            var paramName = "p" + i;
            proxyParams.push(new o.FnParam(paramName));
            proxyReturnEntries.push(o.variable(paramName));
        }
        util_1.createPureProxy(o.fn(proxyParams, [new o.ReturnStatement(o.literalArr(proxyReturnEntries))]), values.length, proxyExpr, this);
        return proxyExpr.callFn(values);
    };
    CompileView.prototype.createLiteralMap = function (entries) {
        if (entries.length === 0) {
            return o.importExpr(identifiers_1.Identifiers.EMPTY_MAP);
        }
        var proxyExpr = o.THIS_EXPR.prop("_map_" + this.literalMapCount++);
        var proxyParams = [];
        var proxyReturnEntries = [];
        var values = [];
        for (var i = 0; i < entries.length; i++) {
            var paramName = "p" + i;
            proxyParams.push(new o.FnParam(paramName));
            proxyReturnEntries.push([entries[i][0], o.variable(paramName)]);
            values.push(entries[i][1]);
        }
        util_1.createPureProxy(o.fn(proxyParams, [new o.ReturnStatement(o.literalMap(proxyReturnEntries))]), entries.length, proxyExpr, this);
        return proxyExpr.callFn(values);
    };
    CompileView.prototype.afterNodes = function () {
        var _this = this;
        this.pipes.forEach(function (pipe) { return pipe.create(); });
        this.viewQueries.values().forEach(function (queries) { return queries.forEach(function (query) { return query.afterChildren(_this.updateViewQueriesMethod); }); });
    };
    return CompileView;
}());
exports.CompileView = CompileView;
function getViewType(component, embeddedTemplateIndex) {
    if (embeddedTemplateIndex > 0) {
        return view_type_1.ViewType.EMBEDDED;
    }
    else if (component.type.isHost) {
        return view_type_1.ViewType.HOST;
    }
    else {
        return view_type_1.ViewType.COMPONENT;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZV92aWV3LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZGlmZmluZ19wbHVnaW5fd3JhcHBlci1vdXRwdXRfcGF0aC14dXluR0pyTy50bXAvYW5ndWxhcjIvc3JjL2NvbXBpbGVyL3ZpZXdfY29tcGlsZXIvY29tcGlsZV92aWV3LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSxxQkFBaUMsMEJBQTBCLENBQUMsQ0FBQTtBQUM1RCwyQkFBd0QsZ0NBQWdDLENBQUMsQ0FBQTtBQUV6RixJQUFZLENBQUMsV0FBTSxzQkFBc0IsQ0FBQyxDQUFBO0FBQzFDLDBCQUErQixhQUFhLENBQUMsQ0FBQTtBQUM3Qyw4QkFBZ0UsaUJBQWlCLENBQUMsQ0FBQTtBQUdsRiwrQkFBNEIsa0JBQWtCLENBQUMsQ0FBQTtBQUMvQyw2QkFBMEIsZ0JBQWdCLENBQUMsQ0FBQTtBQUMzQywwQkFBdUIsb0NBQW9DLENBQUMsQ0FBQTtBQUM1RCxpQ0FLTyxxQkFBcUIsQ0FBQyxDQUFBO0FBQzdCLHFCQU1PLFFBQVEsQ0FBQyxDQUFBO0FBR2hCLDRCQUEwQixnQkFBZ0IsQ0FBQyxDQUFBO0FBRTNDO0lBMENFLHFCQUFtQixTQUFtQyxFQUFTLFNBQXlCLEVBQ3JFLFNBQWdDLEVBQVMsTUFBb0IsRUFDN0QsU0FBaUIsRUFBUyxrQkFBa0MsRUFDNUQsd0JBQW9DO1FBN0N6RCxpQkEwS0M7UUFoSW9CLGNBQVMsR0FBVCxTQUFTLENBQTBCO1FBQVMsY0FBUyxHQUFULFNBQVMsQ0FBZ0I7UUFDckUsY0FBUyxHQUFULFNBQVMsQ0FBdUI7UUFBUyxXQUFNLEdBQU4sTUFBTSxDQUFjO1FBQzdELGNBQVMsR0FBVCxTQUFTLENBQVE7UUFBUyx1QkFBa0IsR0FBbEIsa0JBQWtCLENBQWdCO1FBQzVELDZCQUF3QixHQUF4Qix3QkFBd0IsQ0FBWTtRQXpDaEQsVUFBSyxHQUFrQixFQUFFLENBQUM7UUFDakMsK0NBQStDO1FBQ3hDLDJCQUFzQixHQUFtQixFQUFFLENBQUM7UUFF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QUFDLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxPQUFPLENBQzdCLFVBQUMsT0FBTyxJQUFLLE9BQUEsT0FBTyxDQUFDLE9BQU8sQ0FBQyxVQUFDLEtBQUssSUFBSyxPQUFBLEtBQUssQ0FBQyxhQUFhLENBQUMsS0FBSSxDQUFDLHVCQUF1QixDQUFDLEVBQWpELENBQWlELENBQUMsRUFBN0UsQ0FBNkUsQ0FBQyxDQUFDO0lBQ2xHLENBQUM7SUFDSCxrQkFBQztBQUFELENBQUMsQUExS0QsSUEwS0M7QUExS1ksbUJBQVcsY0EwS3ZCLENBQUE7QUFFRCxxQkFBcUIsU0FBbUMsRUFBRSxxQkFBNkI7SUFDckYsRUFBRSxDQUFDLENBQUMscUJBQXFCLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM5QixNQUFNLENBQUMsb0JBQVEsQ0FBQyxRQUFRLENBQUM7SUFDM0IsQ0FBQztJQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7UUFDakMsTUFBTSxDQUFDLG9CQUFRLENBQUMsSUFBSSxDQUFDO0lBQ3ZCLENBQUM7SUFBQyxJQUFJLENBQUMsQ0FBQztRQUNOLE1BQU0sQ0FBQyxvQkFBUSxDQUFDLFNBQVMsQ0FBQztJQUM1QixDQUFDO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7aXNQcmVzZW50LCBpc0JsYW5rfSBmcm9tICdhbmd1bGFyMi9zcmMvZmFjYWRlL2xhbmcnO1xuaW1wb3J0IHtMaXN0V3JhcHBlciwgU3RyaW5nTWFwV3JhcHBlciwgTWFwV3JhcHBlcn0gZnJvbSAnYW5ndWxhcjIvc3JjL2ZhY2FkZS9jb2xsZWN0aW9uJztcblxuaW1wb3J0ICogYXMgbyBmcm9tICcuLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge0V2ZW50SGFuZGxlclZhcnN9IGZyb20gJy4vY29uc3RhbnRzJztcbmltcG9ydCB7Q29tcGlsZVF1ZXJ5LCBjcmVhdGVRdWVyeUxpc3QsIGFkZFF1ZXJ5VG9Ub2tlbk1hcH0gZnJvbSAnLi9jb21waWxlX3F1ZXJ5JztcbmltcG9ydCB7TmFtZVJlc29sdmVyfSBmcm9tICcuL2V4cHJlc3Npb25fY29udmVydGVyJztcbmltcG9ydCB7Q29tcGlsZUVsZW1lbnQsIENvbXBpbGVOb2RlfSBmcm9tICcuL2NvbXBpbGVfZWxlbWVudCc7XG5pbXBvcnQge0NvbXBpbGVNZXRob2R9IGZyb20gJy4vY29tcGlsZV9tZXRob2QnO1xuaW1wb3J0IHtDb21waWxlUGlwZX0gZnJvbSAnLi9jb21waWxlX3BpcGUnO1xuaW1wb3J0IHtWaWV3VHlwZX0gZnJvbSAnYW5ndWxhcjIvc3JjL2NvcmUvbGlua2VyL3ZpZXdfdHlwZSc7XG5pbXBvcnQge1xuICBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGEsXG4gIENvbXBpbGVQaXBlTWV0YWRhdGEsXG4gIENvbXBpbGVJZGVudGlmaWVyTWV0YWRhdGEsXG4gIENvbXBpbGVUb2tlbk1hcFxufSBmcm9tICcuLi9jb21waWxlX21ldGFkYXRhJztcbmltcG9ydCB7XG4gIGdldFZpZXdGYWN0b3J5TmFtZSxcbiAgaW5qZWN0RnJvbVZpZXdQYXJlbnRJbmplY3RvcixcbiAgY3JlYXRlRGlUb2tlbkV4cHJlc3Npb24sXG4gIGdldFByb3BlcnR5SW5WaWV3LFxuICBjcmVhdGVQdXJlUHJveHlcbn0gZnJvbSAnLi91dGlsJztcbmltcG9ydCB7Q29tcGlsZXJDb25maWd9IGZyb20gJy4uL2NvbmZpZyc7XG5pbXBvcnQge0NvbXBpbGVCaW5kaW5nfSBmcm9tICcuL2NvbXBpbGVfYmluZGluZyc7XG5pbXBvcnQge0lkZW50aWZpZXJzfSBmcm9tICcuLi9pZGVudGlmaWVycyc7XG5cbmV4cG9ydCBjbGFzcyBDb21waWxlVmlldyBpbXBsZW1lbnRzIE5hbWVSZXNvbHZlciB7XG4gIHB1YmxpYyB2aWV3VHlwZTogVmlld1R5cGU7XG4gIHB1YmxpYyB2aWV3UXVlcmllczogQ29tcGlsZVRva2VuTWFwPENvbXBpbGVRdWVyeVtdPjtcblxuICBwdWJsaWMgbm9kZXM6IENvbXBpbGVOb2RlW10gPSBbXTtcbiAgLy8gcm9vdCBub2RlcyBvciBBcHBFbGVtZW50cyBmb3IgVmlld0NvbnRhaW5lcnNcbiAgcHVibGljIHJvb3ROb2Rlc09yQXBwRWxlbWVudHM6IG8uRXhwcmVzc2lvbltdID0gW107XG5cbiAgcHVibGljIGJpbmRpbmdzOiBDb21waWxlQmluZGluZ1tdID0gW107XG5cbiAgcHVibGljIGNsYXNzU3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBwdWJsaWMgY3JlYXRlTWV0aG9kOiBDb21waWxlTWV0aG9kO1xuICBwdWJsaWMgaW5qZWN0b3JHZXRNZXRob2Q6IENvbXBpbGVNZXRob2Q7XG4gIHB1YmxpYyB1cGRhdGVDb250ZW50UXVlcmllc01ldGhvZDogQ29tcGlsZU1ldGhvZDtcbiAgcHVibGljIGRpcnR5UGFyZW50UXVlcmllc01ldGhvZDogQ29tcGlsZU1ldGhvZDtcbiAgcHVibGljIHVwZGF0ZVZpZXdRdWVyaWVzTWV0aG9kOiBDb21waWxlTWV0aG9kO1xuICBwdWJsaWMgZGV0ZWN0Q2hhbmdlc0luSW5wdXRzTWV0aG9kOiBDb21waWxlTWV0aG9kO1xuICBwdWJsaWMgZGV0ZWN0Q2hhbmdlc1JlbmRlclByb3BlcnRpZXNNZXRob2Q6IENvbXBpbGVNZXRob2Q7XG4gIHB1YmxpYyBhZnRlckNvbnRlbnRMaWZlY3ljbGVDYWxsYmFja3NNZXRob2Q6IENvbXBpbGVNZXRob2Q7XG4gIHB1YmxpYyBhZnRlclZpZXdMaWZlY3ljbGVDYWxsYmFja3NNZXRob2Q6IENvbXBpbGVNZXRob2Q7XG4gIHB1YmxpYyBkZXN0cm95TWV0aG9kOiBDb21waWxlTWV0aG9kO1xuICBwdWJsaWMgZXZlbnRIYW5kbGVyTWV0aG9kczogby5DbGFzc01ldGhvZFtdID0gW107XG5cbiAgcHVibGljIGZpZWxkczogby5DbGFzc0ZpZWxkW10gPSBbXTtcbiAgcHVibGljIGdldHRlcnM6IG8uQ2xhc3NHZXR0ZXJbXSA9IFtdO1xuICBwdWJsaWMgZGlzcG9zYWJsZXM6IG8uRXhwcmVzc2lvbltdID0gW107XG4gIHB1YmxpYyBzdWJzY3JpcHRpb25zOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuXG4gIHB1YmxpYyBjb21wb25lbnRWaWV3OiBDb21waWxlVmlldztcbiAgcHVibGljIHB1cmVQaXBlcyA9IG5ldyBNYXA8c3RyaW5nLCBDb21waWxlUGlwZT4oKTtcbiAgcHVibGljIHBpcGVzOiBDb21waWxlUGlwZVtdID0gW107XG4gIHB1YmxpYyBsb2NhbHMgPSBuZXcgTWFwPHN0cmluZywgby5FeHByZXNzaW9uPigpO1xuICBwdWJsaWMgY2xhc3NOYW1lOiBzdHJpbmc7XG4gIHB1YmxpYyBjbGFzc1R5cGU6IG8uVHlwZTtcbiAgcHVibGljIHZpZXdGYWN0b3J5OiBvLlJlYWRWYXJFeHByO1xuXG4gIHB1YmxpYyBsaXRlcmFsQXJyYXlDb3VudCA9IDA7XG4gIHB1YmxpYyBsaXRlcmFsTWFwQ291bnQgPSAwO1xuICBwdWJsaWMgcGlwZUNvdW50ID0gMDtcblxuICBwdWJsaWMgY29tcG9uZW50Q29udGV4dDogby5FeHByZXNzaW9uO1xuXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBjb21wb25lbnQ6IENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSwgcHVibGljIGdlbkNvbmZpZzogQ29tcGlsZXJDb25maWcsXG4gICAgICAgICAgICAgIHB1YmxpYyBwaXBlTWV0YXM6IENvbXBpbGVQaXBlTWV0YWRhdGFbXSwgcHVibGljIHN0eWxlczogby5FeHByZXNzaW9uLFxuICAgICAgICAgICAgICBwdWJsaWMgdmlld0luZGV4OiBudW1iZXIsIHB1YmxpYyBkZWNsYXJhdGlvbkVsZW1lbnQ6IENvbXBpbGVFbGVtZW50LFxuICAgICAgICAgICAgICBwdWJsaWMgdGVtcGxhdGVWYXJpYWJsZUJpbmRpbmdzOiBzdHJpbmdbXVtdKSB7XG4gICAgdGhpcy5jcmVhdGVNZXRob2QgPSBuZXcgQ29tcGlsZU1ldGhvZCh0aGlzKTtcbiAgICB0aGlzLmluamVjdG9yR2V0TWV0aG9kID0gbmV3IENvbXBpbGVNZXRob2QodGhpcyk7XG4gICAgdGhpcy51cGRhdGVDb250ZW50UXVlcmllc01ldGhvZCA9IG5ldyBDb21waWxlTWV0aG9kKHRoaXMpO1xuICAgIHRoaXMuZGlydHlQYXJlbnRRdWVyaWVzTWV0aG9kID0gbmV3IENvbXBpbGVNZXRob2QodGhpcyk7XG4gICAgdGhpcy51cGRhdGVWaWV3UXVlcmllc01ldGhvZCA9IG5ldyBDb21waWxlTWV0aG9kKHRoaXMpO1xuICAgIHRoaXMuZGV0ZWN0Q2hhbmdlc0luSW5wdXRzTWV0aG9kID0gbmV3IENvbXBpbGVNZXRob2QodGhpcyk7XG4gICAgdGhpcy5kZXRlY3RDaGFuZ2VzUmVuZGVyUHJvcGVydGllc01ldGhvZCA9IG5ldyBDb21waWxlTWV0aG9kKHRoaXMpO1xuXG4gICAgdGhpcy5hZnRlckNvbnRlbnRMaWZlY3ljbGVDYWxsYmFja3NNZXRob2QgPSBuZXcgQ29tcGlsZU1ldGhvZCh0aGlzKTtcbiAgICB0aGlzLmFmdGVyVmlld0xpZmVjeWNsZUNhbGxiYWNrc01ldGhvZCA9IG5ldyBDb21waWxlTWV0aG9kKHRoaXMpO1xuICAgIHRoaXMuZGVzdHJveU1ldGhvZCA9IG5ldyBDb21waWxlTWV0aG9kKHRoaXMpO1xuXG4gICAgdGhpcy52aWV3VHlwZSA9IGdldFZpZXdUeXBlKGNvbXBvbmVudCwgdmlld0luZGV4KTtcbiAgICB0aGlzLmNsYXNzTmFtZSA9IGBfVmlld18ke2NvbXBvbmVudC50eXBlLm5hbWV9JHt2aWV3SW5kZXh9YDtcbiAgICB0aGlzLmNsYXNzVHlwZSA9IG8uaW1wb3J0VHlwZShuZXcgQ29tcGlsZUlkZW50aWZpZXJNZXRhZGF0YSh7bmFtZTogdGhpcy5jbGFzc05hbWV9KSk7XG4gICAgdGhpcy52aWV3RmFjdG9yeSA9IG8udmFyaWFibGUoZ2V0Vmlld0ZhY3RvcnlOYW1lKGNvbXBvbmVudCwgdmlld0luZGV4KSk7XG4gICAgaWYgKHRoaXMudmlld1R5cGUgPT09IFZpZXdUeXBlLkNPTVBPTkVOVCB8fCB0aGlzLnZpZXdUeXBlID09PSBWaWV3VHlwZS5IT1NUKSB7XG4gICAgICB0aGlzLmNvbXBvbmVudFZpZXcgPSB0aGlzO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmNvbXBvbmVudFZpZXcgPSB0aGlzLmRlY2xhcmF0aW9uRWxlbWVudC52aWV3LmNvbXBvbmVudFZpZXc7XG4gICAgfVxuICAgIHRoaXMuY29tcG9uZW50Q29udGV4dCA9XG4gICAgICAgIGdldFByb3BlcnR5SW5WaWV3KG8uVEhJU19FWFBSLnByb3AoJ2NvbnRleHQnKSwgdGhpcywgdGhpcy5jb21wb25lbnRWaWV3KTtcblxuICAgIHZhciB2aWV3UXVlcmllcyA9IG5ldyBDb21waWxlVG9rZW5NYXA8Q29tcGlsZVF1ZXJ5W10+KCk7XG4gICAgaWYgKHRoaXMudmlld1R5cGUgPT09IFZpZXdUeXBlLkNPTVBPTkVOVCkge1xuICAgICAgdmFyIGRpcmVjdGl2ZUluc3RhbmNlID0gby5USElTX0VYUFIucHJvcCgnY29udGV4dCcpO1xuICAgICAgTGlzdFdyYXBwZXIuZm9yRWFjaFdpdGhJbmRleCh0aGlzLmNvbXBvbmVudC52aWV3UXVlcmllcywgKHF1ZXJ5TWV0YSwgcXVlcnlJbmRleCkgPT4ge1xuICAgICAgICB2YXIgcHJvcE5hbWUgPSBgX3ZpZXdRdWVyeV8ke3F1ZXJ5TWV0YS5zZWxlY3RvcnNbMF0ubmFtZX1fJHtxdWVyeUluZGV4fWA7XG4gICAgICAgIHZhciBxdWVyeUxpc3QgPSBjcmVhdGVRdWVyeUxpc3QocXVlcnlNZXRhLCBkaXJlY3RpdmVJbnN0YW5jZSwgcHJvcE5hbWUsIHRoaXMpO1xuICAgICAgICB2YXIgcXVlcnkgPSBuZXcgQ29tcGlsZVF1ZXJ5KHF1ZXJ5TWV0YSwgcXVlcnlMaXN0LCBkaXJlY3RpdmVJbnN0YW5jZSwgdGhpcyk7XG4gICAgICAgIGFkZFF1ZXJ5VG9Ub2tlbk1hcCh2aWV3UXVlcmllcywgcXVlcnkpO1xuICAgICAgfSk7XG4gICAgICB2YXIgY29uc3RydWN0b3JWaWV3UXVlcnlDb3VudCA9IDA7XG4gICAgICB0aGlzLmNvbXBvbmVudC50eXBlLmRpRGVwcy5mb3JFYWNoKChkZXApID0+IHtcbiAgICAgICAgaWYgKGlzUHJlc2VudChkZXAudmlld1F1ZXJ5KSkge1xuICAgICAgICAgIHZhciBxdWVyeUxpc3QgPSBvLlRISVNfRVhQUi5wcm9wKCdkZWNsYXJhdGlvbkFwcEVsZW1lbnQnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnByb3AoJ2NvbXBvbmVudENvbnN0cnVjdG9yVmlld1F1ZXJpZXMnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmtleShvLmxpdGVyYWwoY29uc3RydWN0b3JWaWV3UXVlcnlDb3VudCsrKSk7XG4gICAgICAgICAgdmFyIHF1ZXJ5ID0gbmV3IENvbXBpbGVRdWVyeShkZXAudmlld1F1ZXJ5LCBxdWVyeUxpc3QsIG51bGwsIHRoaXMpO1xuICAgICAgICAgIGFkZFF1ZXJ5VG9Ub2tlbk1hcCh2aWV3UXVlcmllcywgcXVlcnkpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gICAgdGhpcy52aWV3UXVlcmllcyA9IHZpZXdRdWVyaWVzO1xuICAgIHRlbXBsYXRlVmFyaWFibGVCaW5kaW5ncy5mb3JFYWNoKFxuICAgICAgICAoZW50cnkpID0+IHsgdGhpcy5sb2NhbHMuc2V0KGVudHJ5WzFdLCBvLlRISVNfRVhQUi5wcm9wKCdjb250ZXh0JykucHJvcChlbnRyeVswXSkpOyB9KTtcblxuICAgIGlmICghdGhpcy5kZWNsYXJhdGlvbkVsZW1lbnQuaXNOdWxsKCkpIHtcbiAgICAgIHRoaXMuZGVjbGFyYXRpb25FbGVtZW50LnNldEVtYmVkZGVkVmlldyh0aGlzKTtcbiAgICB9XG4gIH1cblxuICBjYWxsUGlwZShuYW1lOiBzdHJpbmcsIGlucHV0OiBvLkV4cHJlc3Npb24sIGFyZ3M6IG8uRXhwcmVzc2lvbltdKTogby5FeHByZXNzaW9uIHtcbiAgICB2YXIgY29tcFZpZXcgPSB0aGlzLmNvbXBvbmVudFZpZXc7XG4gICAgdmFyIHBpcGUgPSBjb21wVmlldy5wdXJlUGlwZXMuZ2V0KG5hbWUpO1xuICAgIGlmIChpc0JsYW5rKHBpcGUpKSB7XG4gICAgICBwaXBlID0gbmV3IENvbXBpbGVQaXBlKGNvbXBWaWV3LCBuYW1lKTtcbiAgICAgIGlmIChwaXBlLnB1cmUpIHtcbiAgICAgICAgY29tcFZpZXcucHVyZVBpcGVzLnNldChuYW1lLCBwaXBlKTtcbiAgICAgIH1cbiAgICAgIGNvbXBWaWV3LnBpcGVzLnB1c2gocGlwZSk7XG4gICAgfVxuICAgIHJldHVybiBwaXBlLmNhbGwodGhpcywgW2lucHV0XS5jb25jYXQoYXJncykpO1xuICB9XG5cbiAgZ2V0TG9jYWwobmFtZTogc3RyaW5nKTogby5FeHByZXNzaW9uIHtcbiAgICBpZiAobmFtZSA9PSBFdmVudEhhbmRsZXJWYXJzLmV2ZW50Lm5hbWUpIHtcbiAgICAgIHJldHVybiBFdmVudEhhbmRsZXJWYXJzLmV2ZW50O1xuICAgIH1cbiAgICB2YXIgY3VyclZpZXc6IENvbXBpbGVWaWV3ID0gdGhpcztcbiAgICB2YXIgcmVzdWx0ID0gY3VyclZpZXcubG9jYWxzLmdldChuYW1lKTtcbiAgICB3aGlsZSAoaXNCbGFuayhyZXN1bHQpICYmIGlzUHJlc2VudChjdXJyVmlldy5kZWNsYXJhdGlvbkVsZW1lbnQudmlldykpIHtcbiAgICAgIGN1cnJWaWV3ID0gY3VyclZpZXcuZGVjbGFyYXRpb25FbGVtZW50LnZpZXc7XG4gICAgICByZXN1bHQgPSBjdXJyVmlldy5sb2NhbHMuZ2V0KG5hbWUpO1xuICAgIH1cbiAgICBpZiAoaXNQcmVzZW50KHJlc3VsdCkpIHtcbiAgICAgIHJldHVybiBnZXRQcm9wZXJ0eUluVmlldyhyZXN1bHQsIHRoaXMsIGN1cnJWaWV3KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgY3JlYXRlTGl0ZXJhbEFycmF5KHZhbHVlczogby5FeHByZXNzaW9uW10pOiBvLkV4cHJlc3Npb24ge1xuICAgIGlmICh2YWx1ZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKElkZW50aWZpZXJzLkVNUFRZX0FSUkFZKTtcbiAgICB9XG4gICAgdmFyIHByb3h5RXhwciA9IG8uVEhJU19FWFBSLnByb3AoYF9hcnJfJHt0aGlzLmxpdGVyYWxBcnJheUNvdW50Kyt9YCk7XG4gICAgdmFyIHByb3h5UGFyYW1zOiBvLkZuUGFyYW1bXSA9IFtdO1xuICAgIHZhciBwcm94eVJldHVybkVudHJpZXM6IG8uRXhwcmVzc2lvbltdID0gW107XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB2YWx1ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBwYXJhbU5hbWUgPSBgcCR7aX1gO1xuICAgICAgcHJveHlQYXJhbXMucHVzaChuZXcgby5GblBhcmFtKHBhcmFtTmFtZSkpO1xuICAgICAgcHJveHlSZXR1cm5FbnRyaWVzLnB1c2goby52YXJpYWJsZShwYXJhbU5hbWUpKTtcbiAgICB9XG4gICAgY3JlYXRlUHVyZVByb3h5KG8uZm4ocHJveHlQYXJhbXMsIFtuZXcgby5SZXR1cm5TdGF0ZW1lbnQoby5saXRlcmFsQXJyKHByb3h5UmV0dXJuRW50cmllcykpXSksXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlcy5sZW5ndGgsIHByb3h5RXhwciwgdGhpcyk7XG4gICAgcmV0dXJuIHByb3h5RXhwci5jYWxsRm4odmFsdWVzKTtcbiAgfVxuXG4gIGNyZWF0ZUxpdGVyYWxNYXAoZW50cmllczogQXJyYXk8QXJyYXk8c3RyaW5nIHwgby5FeHByZXNzaW9uPj4pOiBvLkV4cHJlc3Npb24ge1xuICAgIGlmIChlbnRyaWVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihJZGVudGlmaWVycy5FTVBUWV9NQVApO1xuICAgIH1cbiAgICB2YXIgcHJveHlFeHByID0gby5USElTX0VYUFIucHJvcChgX21hcF8ke3RoaXMubGl0ZXJhbE1hcENvdW50Kyt9YCk7XG4gICAgdmFyIHByb3h5UGFyYW1zOiBvLkZuUGFyYW1bXSA9IFtdO1xuICAgIHZhciBwcm94eVJldHVybkVudHJpZXM6IEFycmF5PEFycmF5PHN0cmluZyB8IG8uRXhwcmVzc2lvbj4+ID0gW107XG4gICAgdmFyIHZhbHVlczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGVudHJpZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBwYXJhbU5hbWUgPSBgcCR7aX1gO1xuICAgICAgcHJveHlQYXJhbXMucHVzaChuZXcgby5GblBhcmFtKHBhcmFtTmFtZSkpO1xuICAgICAgcHJveHlSZXR1cm5FbnRyaWVzLnB1c2goW2VudHJpZXNbaV1bMF0sIG8udmFyaWFibGUocGFyYW1OYW1lKV0pO1xuICAgICAgdmFsdWVzLnB1c2goPG8uRXhwcmVzc2lvbj5lbnRyaWVzW2ldWzFdKTtcbiAgICB9XG4gICAgY3JlYXRlUHVyZVByb3h5KG8uZm4ocHJveHlQYXJhbXMsIFtuZXcgby5SZXR1cm5TdGF0ZW1lbnQoby5saXRlcmFsTWFwKHByb3h5UmV0dXJuRW50cmllcykpXSksXG4gICAgICAgICAgICAgICAgICAgIGVudHJpZXMubGVuZ3RoLCBwcm94eUV4cHIsIHRoaXMpO1xuICAgIHJldHVybiBwcm94eUV4cHIuY2FsbEZuKHZhbHVlcyk7XG4gIH1cblxuICBhZnRlck5vZGVzKCkge1xuICAgIHRoaXMucGlwZXMuZm9yRWFjaCgocGlwZSkgPT4gcGlwZS5jcmVhdGUoKSk7XG4gICAgdGhpcy52aWV3UXVlcmllcy52YWx1ZXMoKS5mb3JFYWNoKFxuICAgICAgICAocXVlcmllcykgPT4gcXVlcmllcy5mb3JFYWNoKChxdWVyeSkgPT4gcXVlcnkuYWZ0ZXJDaGlsZHJlbih0aGlzLnVwZGF0ZVZpZXdRdWVyaWVzTWV0aG9kKSkpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGdldFZpZXdUeXBlKGNvbXBvbmVudDogQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhLCBlbWJlZGRlZFRlbXBsYXRlSW5kZXg6IG51bWJlcik6IFZpZXdUeXBlIHtcbiAgaWYgKGVtYmVkZGVkVGVtcGxhdGVJbmRleCA+IDApIHtcbiAgICByZXR1cm4gVmlld1R5cGUuRU1CRURERUQ7XG4gIH0gZWxzZSBpZiAoY29tcG9uZW50LnR5cGUuaXNIb3N0KSB7XG4gICAgcmV0dXJuIFZpZXdUeXBlLkhPU1Q7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIFZpZXdUeXBlLkNPTVBPTkVOVDtcbiAgfVxufVxuIl19