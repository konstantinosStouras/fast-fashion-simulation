import{a as Oe,b as W}from"./shared-L2TK2CJG.js";import{a as Wt,c as Jt,d as Ht,f as Yt}from"./shared-W2YBBZWE.js";import{F as Qt,G as Kt,a as Ft,b as xe,c as xt,d as qt,e as Ot,h as Ct,i as Lt,j as $,k as $t,l as ae,m as Mt,n as Ut,o as jt,p as Bt,q as zt,s as Gt,t as qe}from"./shared-Z6YTO4IC.js";var Xt="4.9.2";var w=class{constructor(e){this.uid=e}isAuthenticated(){return this.uid!=null}toKey(){return this.isAuthenticated()?"uid:"+this.uid:"anonymous-user"}isEqual(e){return e.uid===this.uid}};w.UNAUTHENTICATED=new w(null),w.GOOGLE_CREDENTIALS=new w("google-credentials-uid"),w.FIRST_PARTY=new w("first-party-uid"),w.MOCK_USER=new w("mock-user");var Q="12.3.0";var j=new Mt("@firebase/firestore");function ce(n,...e){if(j.logLevel<=ae.DEBUG){let t=e.map(At);j.debug(`Firestore (${Q}): ${n}`,...t)}}function Vt(n,...e){if(j.logLevel<=ae.ERROR){let t=e.map(At);j.error(`Firestore (${Q}): ${n}`,...t)}}function wn(n,...e){if(j.logLevel<=ae.WARN){let t=e.map(At);j.warn(`Firestore (${Q}): ${n}`,...t)}}function At(n){if(typeof n=="string")return n;try{return(function(t){return JSON.stringify(t)})(n)}catch{return n}}function _(n,e,t){let r="Unexpected state";typeof e=="string"?r=e:t=e,Tn(n,r,t)}function Tn(n,e,t){let r=`FIRESTORE (${Q}) INTERNAL ASSERTION FAILED: ${e} (ID: ${n.toString(16)})`;if(t!==void 0)try{r+=" CONTEXT: "+JSON.stringify(t)}catch{r+=" CONTEXT: "+t}throw Vt(r),new Error(r)}function I(n,e,t,r){let i="Unexpected state";typeof t=="string"?i=t:r=t,n||Tn(e,i,r)}function ke(n,e){return n}var Zt="ok",Yn="cancelled",J="unknown",d="invalid-argument",Xn="deadline-exceeded",Zn="not-found";var er="permission-denied",Me="unauthenticated",tr="resource-exhausted",B="failed-precondition",nr="aborted",rr="out-of-range",vn="unimplemented",ir="internal",sr="unavailable";var c=class extends Ct{constructor(e,t){super(e,t),this.code=e,this.message=t,this.toString=()=>`${this.name}: [code=${this.code}]: ${this.message}`}};var he=class{constructor(e,t){this.user=t,this.type="OAuth",this.headers=new Map,this.headers.set("Authorization",`Bearer ${e}`)}},Ue=class{getToken(){return Promise.resolve(null)}invalidateToken(){}start(e,t){e.enqueueRetryable((()=>t(w.UNAUTHENTICATED)))}shutdown(){}},je=class{constructor(e){this.token=e,this.changeListener=null}getToken(){return Promise.resolve(this.token)}invalidateToken(){}start(e,t){this.changeListener=t,e.enqueueRetryable((()=>t(this.token.user)))}shutdown(){this.changeListener=null}},Be=class{constructor(e){this.auth=null,e.onInit((t=>{this.auth=t}))}getToken(){return this.auth?this.auth.getToken().then((e=>e?(I(typeof e.accessToken=="string",42297,{t:e}),new he(e.accessToken,new w(this.auth.getUid()))):null)):Promise.resolve(null)}invalidateToken(){}start(e,t){}shutdown(){}},ze=class{constructor(e,t,r){this.i=e,this.o=t,this.u=r,this.type="FirstParty",this.user=w.FIRST_PARTY,this.l=new Map}h(){return this.u?this.u():null}get headers(){this.l.set("X-Goog-AuthUser",this.i);let e=this.h();return e&&this.l.set("Authorization",e),this.o&&this.l.set("X-Goog-Iam-Authorization-Token",this.o),this.l}},Ge=class{constructor(e,t,r){this.i=e,this.o=t,this.u=r}getToken(){return Promise.resolve(new ze(this.i,this.o,this.u))}start(e,t){e.enqueueRetryable((()=>t(w.FIRST_PARTY)))}shutdown(){}invalidateToken(){}},de=class{constructor(e){this.value=e,this.type="AppCheck",this.headers=new Map,e&&e.length>0&&this.headers.set("x-firebase-appcheck",this.value)}},Qe=class{constructor(e,t){this.m=t,this.appCheck=null,this.T=null,Bt(e)&&e.settings.appCheckToken&&(this.T=e.settings.appCheckToken),t.onInit((r=>{this.appCheck=r}))}getToken(){return this.T?Promise.resolve(new de(this.T)):this.appCheck?this.appCheck.getToken().then((e=>e?(I(typeof e.token=="string",3470,{tokenResult:e}),new de(e.token)):null)):Promise.resolve(null)}invalidateToken(){}start(e,t){}shutdown(){}};var Ke=class{constructor(e,t,r,i,s,o,u,a,l,h){this.databaseId=e,this.appId=t,this.persistenceKey=r,this.host=i,this.ssl=s,this.forceLongPolling=o,this.autoDetectLongPolling=u,this.longPollingOptions=a,this.useFetchStreams=l,this.isUsingEmulator=h}},We="(default)",fe=class n{constructor(e,t){this.projectId=e,this.database=t||We}static empty(){return new n("","")}get isDefaultDatabase(){return this.database===We}isEqual(e){return e instanceof n&&e.projectId===this.projectId&&e.database===this.database}};function or(n){let e=typeof self<"u"&&(self.crypto||self.msCrypto),t=new Uint8Array(n);if(e&&typeof e.getRandomValues=="function")e.getRandomValues(t);else for(let r=0;r<n;r++)t[r]=Math.floor(256*Math.random());return t}var Je=class{static newId(){let e="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",t=62*Math.floor(4.129032258064516),r="";for(;r.length<20;){let i=or(40);for(let s=0;s<i.length;++s)r.length<20&&i[s]<t&&(r+=e.charAt(i[s]%62))}return r}};function p(n,e){return n<e?-1:n>e?1:0}function He(n,e){let t=Math.min(n.length,e.length);for(let r=0;r<t;r++){let i=n.charAt(r),s=e.charAt(r);if(i!==s)return Ce(i)===Ce(s)?p(i,s):Ce(i)?1:-1}return p(n.length,e.length)}var ar=55296,ur=57343;function Ce(n){let e=n.charCodeAt(0);return e>=ar&&e<=ur}function lr(n,e,t){return n.length===e.length&&n.every(((r,i)=>t(r,e[i])))}var en="__name__",me=class n{constructor(e,t,r){t===void 0?t=0:t>e.length&&_(637,{offset:t,range:e.length}),r===void 0?r=e.length-t:r>e.length-t&&_(1746,{length:r,range:e.length-t}),this.segments=e,this.offset=t,this.len=r}get length(){return this.len}isEqual(e){return n.comparator(this,e)===0}child(e){let t=this.segments.slice(this.offset,this.limit());return e instanceof n?e.forEach((r=>{t.push(r)})):t.push(e),this.construct(t)}limit(){return this.offset+this.length}popFirst(e){return e=e===void 0?1:e,this.construct(this.segments,this.offset+e,this.length-e)}popLast(){return this.construct(this.segments,this.offset,this.length-1)}firstSegment(){return this.segments[this.offset]}lastSegment(){return this.get(this.length-1)}get(e){return this.segments[this.offset+e]}isEmpty(){return this.length===0}isPrefixOf(e){if(e.length<this.length)return!1;for(let t=0;t<this.length;t++)if(this.get(t)!==e.get(t))return!1;return!0}isImmediateParentOf(e){if(this.length+1!==e.length)return!1;for(let t=0;t<this.length;t++)if(this.get(t)!==e.get(t))return!1;return!0}forEach(e){for(let t=this.offset,r=this.limit();t<r;t++)e(this.segments[t])}toArray(){return this.segments.slice(this.offset,this.limit())}static comparator(e,t){let r=Math.min(e.length,t.length);for(let i=0;i<r;i++){let s=n.compareSegments(e.get(i),t.get(i));if(s!==0)return s}return p(e.length,t.length)}static compareSegments(e,t){let r=n.isNumericId(e),i=n.isNumericId(t);return r&&!i?-1:!r&&i?1:r&&i?n.extractNumericId(e).compare(n.extractNumericId(t)):He(e,t)}static isNumericId(e){return e.startsWith("__id")&&e.endsWith("__")}static extractNumericId(e){return Wt.fromString(e.substring(4,e.length-2))}},y=class n extends me{construct(e,t,r){return new n(e,t,r)}canonicalString(){return this.toArray().join("/")}toString(){return this.canonicalString()}toUriEncodedString(){return this.toArray().map(encodeURIComponent).join("/")}static fromString(...e){let t=[];for(let r of e){if(r.indexOf("//")>=0)throw new c(d,`Invalid segment (${r}). Paths must not contain // in them.`);t.push(...r.split("/").filter((i=>i.length>0)))}return new n(t)}static emptyPath(){return new n([])}},cr=/^[_a-zA-Z][_a-zA-Z0-9]*$/,k=class n extends me{construct(e,t,r){return new n(e,t,r)}static isValidIdentifier(e){return cr.test(e)}canonicalString(){return this.toArray().map((e=>(e=e.replace(/\\/g,"\\\\").replace(/`/g,"\\`"),n.isValidIdentifier(e)||(e="`"+e+"`"),e))).join(".")}toString(){return this.canonicalString()}isKeyField(){return this.length===1&&this.get(0)===en}static keyField(){return new n([en])}static fromServerFormat(e){let t=[],r="",i=0,s=()=>{if(r.length===0)throw new c(d,`Invalid field path (${e}). Paths must not be empty, begin with '.', end with '.', or contain '..'`);t.push(r),r=""},o=!1;for(;i<e.length;){let u=e[i];if(u==="\\"){if(i+1===e.length)throw new c(d,"Path has trailing escape character: "+e);let a=e[i+1];if(a!=="\\"&&a!=="."&&a!=="`")throw new c(d,"Path has invalid escape sequence: "+e);r+=a,i+=2}else u==="`"?(o=!o,i++):u!=="."||o?(r+=u,i++):(s(),i++)}if(s(),o)throw new c(d,"Unterminated ` in path: "+e);return new n(t)}static emptyPath(){return new n([])}};var E=class n{constructor(e){this.path=e}static fromPath(e){return new n(y.fromString(e))}static fromName(e){return new n(y.fromString(e).popFirst(5))}static empty(){return new n(y.emptyPath())}get collectionGroup(){return this.path.popLast().lastSegment()}hasCollectionId(e){return this.path.length>=2&&this.path.get(this.path.length-2)===e}getCollectionGroup(){return this.path.get(this.path.length-2)}getCollectionPath(){return this.path.popLast()}isEqual(e){return e!==null&&y.comparator(this.path,e.path)===0}toString(){return this.path.toString()}static comparator(e,t){return y.comparator(e.path,t.path)}static isDocumentKey(e){return e.length%2==0}static fromSegments(e){return new n(new y(e.slice()))}};function En(n,e,t){if(!t)throw new c(d,`Function ${n}() cannot be called with an empty ${e}.`)}function tn(n){if(!E.isDocumentKey(n))throw new c(d,`Invalid document reference. Document references must have an even number of segments, but ${n} has ${n.length}.`)}function nn(n){if(E.isDocumentKey(n))throw new c(d,`Invalid collection reference. Collection references must have an odd number of segments, but ${n} has ${n.length}.`)}function Vn(n){return typeof n=="object"&&n!==null&&(Object.getPrototypeOf(n)===Object.prototype||Object.getPrototypeOf(n)===null)}function Ne(n){if(n===void 0)return"undefined";if(n===null)return"null";if(typeof n=="string")return n.length>20&&(n=`${n.substring(0,20)}...`),JSON.stringify(n);if(typeof n=="number"||typeof n=="boolean")return""+n;if(typeof n=="object"){if(n instanceof Array)return"an array";{let e=(function(r){return r.constructor?r.constructor.name:null})(n);return e?`a custom ${e} object`:"an object"}}return typeof n=="function"?"a function":_(12329,{type:typeof n})}function It(n,e){if("_delegate"in n&&(n=n._delegate),!(n instanceof e)){if(e.name===n.constructor.name)throw new c(d,"Type does not match the expected instance. Did you pass a reference from a different Firestore SDK?");{let t=Ne(n);throw new c(d,`Expected type '${e.name}', but it was: ${t}`)}}return n}function An(n){let e={};return n.timeoutSeconds!==void 0&&(e.timeoutSeconds=n.timeoutSeconds),e}var ue=null;function hr(){return ue===null?ue=(function(){return 268435456+Math.round(2147483648*Math.random())})():ue++,"0x"+ue.toString(16)}function dr(n){return n==null}function pe(n){return n===0&&1/n==-1/0}var Le="RestConnection",fr={BatchGetDocuments:"batchGet",Commit:"commit",RunQuery:"runQuery",RunAggregationQuery:"runAggregationQuery"},Ye=class{get P(){return!1}constructor(e){this.databaseInfo=e,this.databaseId=e.databaseId;let t=e.ssl?"https":"http",r=encodeURIComponent(this.databaseId.projectId),i=encodeURIComponent(this.databaseId.database);this.A=t+"://"+e.host,this.R=`projects/${r}/databases/${i}`,this.V=this.databaseId.database===We?`project_id=${r}`:`project_id=${r}&database_id=${i}`}I(e,t,r,i,s){let o=hr(),u=this.p(e,t.toUriEncodedString());ce(Le,`Sending RPC '${e}' ${o}:`,u,r);let a={"google-cloud-resource-prefix":this.R,"x-goog-request-params":this.V};this.F(a,i,s);let{host:l}=new URL(u),h=xe(l);return this.v(e,u,a,r,h).then((m=>(ce(Le,`Received RPC '${e}' ${o}: `,m),m)),(m=>{throw wn(Le,`RPC '${e}' ${o} failed with error: `,m,"url: ",u,"request:",r),m}))}D(e,t,r,i,s,o){return this.I(e,t,r,i,s)}F(e,t,r){e["X-Goog-Api-Client"]=(function(){return"gl-js/ fire/"+Q})(),e["Content-Type"]="text/plain",this.databaseInfo.appId&&(e["X-Firebase-GMPID"]=this.databaseInfo.appId),t&&t.headers.forEach(((i,s)=>e[s]=i)),r&&r.headers.forEach(((i,s)=>e[s]=i))}p(e,t){let r=fr[e];return`${this.A}/v1/${t}:${r}`}terminate(){}};var rn,f;function sn(n){if(n===void 0)return Vt("RPC_ERROR","HTTP error has no status"),J;switch(n){case 200:return Zt;case 400:return B;case 401:return Me;case 403:return er;case 404:return Zn;case 409:return nr;case 416:return rr;case 429:return tr;case 499:return Yn;case 500:return J;case 501:return vn;case 503:return sr;case 504:return Xn;default:return n>=200&&n<300?Zt:n>=400&&n<500?B:n>=500&&n<600?ir:J}}(f=rn||(rn={}))[f.OK=0]="OK",f[f.CANCELLED=1]="CANCELLED",f[f.UNKNOWN=2]="UNKNOWN",f[f.INVALID_ARGUMENT=3]="INVALID_ARGUMENT",f[f.DEADLINE_EXCEEDED=4]="DEADLINE_EXCEEDED",f[f.NOT_FOUND=5]="NOT_FOUND",f[f.ALREADY_EXISTS=6]="ALREADY_EXISTS",f[f.PERMISSION_DENIED=7]="PERMISSION_DENIED",f[f.UNAUTHENTICATED=16]="UNAUTHENTICATED",f[f.RESOURCE_EXHAUSTED=8]="RESOURCE_EXHAUSTED",f[f.FAILED_PRECONDITION=9]="FAILED_PRECONDITION",f[f.ABORTED=10]="ABORTED",f[f.OUT_OF_RANGE=11]="OUT_OF_RANGE",f[f.UNIMPLEMENTED=12]="UNIMPLEMENTED",f[f.INTERNAL=13]="INTERNAL",f[f.UNAVAILABLE=14]="UNAVAILABLE",f[f.DATA_LOSS=15]="DATA_LOSS";var Xe=class extends Ye{S(e,t){throw new Error("Not supported by FetchConnection")}async v(e,t,r,i,s){let o=JSON.stringify(i),u;try{let a={method:"POST",headers:r,body:o};s&&(a.credentials="include"),u=await fetch(t,a)}catch(a){let l=a;throw new c(sn(l.status),"Request failed with error: "+l.statusText)}if(!u.ok){let a=await u.json();Array.isArray(a)&&(a=a[0]);let l=a?.error?.message;throw new c(sn(u.status),`Request failed with error: ${l??u.statusText}`)}return u.json()}};function on(n){let e=0;for(let t in n)Object.prototype.hasOwnProperty.call(n,t)&&e++;return e}function De(n,e){for(let t in n)Object.prototype.hasOwnProperty.call(n,t)&&e(t,n[t])}var Ze=class extends Error{constructor(){super(...arguments),this.name="Base64DecodeError"}};var q=class n{constructor(e){this.binaryString=e}static fromBase64String(e){let t=(function(i){try{return atob(i)}catch(s){throw typeof DOMException<"u"&&s instanceof DOMException?new Ze("Invalid base64 string: "+s):s}})(e);return new n(t)}static fromUint8Array(e){let t=(function(i){let s="";for(let o=0;o<i.length;++o)s+=String.fromCharCode(i[o]);return s})(e);return new n(t)}[Symbol.iterator](){let e=0;return{next:()=>e<this.binaryString.length?{value:this.binaryString.charCodeAt(e++),done:!1}:{value:void 0,done:!0}}}toBase64(){return(function(t){return btoa(t)})(this.binaryString)}toUint8Array(){return(function(t){let r=new Uint8Array(t.length);for(let i=0;i<t.length;i++)r[i]=t.charCodeAt(i);return r})(this.binaryString)}approximateByteSize(){return 2*this.binaryString.length}compareTo(e){return p(this.binaryString,e.binaryString)}isEqual(e){return this.binaryString===e.binaryString}};q.EMPTY_BYTE_STRING=new q("");var mr=new RegExp(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.(\d+))?Z$/);function O(n){if(I(!!n,39018),typeof n=="string"){let e=0,t=mr.exec(n);if(I(!!t,46558,{timestamp:n}),t[1]){let i=t[1];i=(i+"000000000").substr(0,9),e=Number(i)}let r=new Date(n);return{seconds:Math.floor(r.getTime()/1e3),nanos:e}}return{seconds:g(n.seconds),nanos:g(n.nanos)}}function g(n){return typeof n=="number"?n:typeof n=="string"?Number(n):0}function Z(n){return typeof n=="string"?q.fromBase64String(n):q.fromUint8Array(n)}function P(n,e){let t={typeString:n};return e&&(t.value=e),t}function oe(n,e){if(!Vn(n))throw new c(d,"JSON must be an object");let t;for(let r in e)if(e[r]){let i=e[r].typeString,s="value"in e[r]?{value:e[r].value}:void 0;if(!(r in n)){t=`JSON missing required field: '${r}'`;break}let o=n[r];if(i&&typeof o!==i){t=`JSON field '${r}' must be a ${i}.`;break}if(s!==void 0&&o!==s.value){t=`Expected '${r}' field to equal '${s.value}'`;break}}if(t)throw new c(d,t);return!0}var an=-62135596800,un=1e6,A=class n{static now(){return n.fromMillis(Date.now())}static fromDate(e){return n.fromMillis(e.getTime())}static fromMillis(e){let t=Math.floor(e/1e3),r=Math.floor((e-1e3*t)*un);return new n(t,r)}constructor(e,t){if(this.seconds=e,this.nanoseconds=t,t<0)throw new c(d,"Timestamp nanoseconds out of range: "+t);if(t>=1e9)throw new c(d,"Timestamp nanoseconds out of range: "+t);if(e<an)throw new c(d,"Timestamp seconds out of range: "+e);if(e>=253402300800)throw new c(d,"Timestamp seconds out of range: "+e)}toDate(){return new Date(this.toMillis())}toMillis(){return 1e3*this.seconds+this.nanoseconds/un}_compareTo(e){return this.seconds===e.seconds?p(this.nanoseconds,e.nanoseconds):p(this.seconds,e.seconds)}isEqual(e){return e.seconds===this.seconds&&e.nanoseconds===this.nanoseconds}toString(){return"Timestamp(seconds="+this.seconds+", nanoseconds="+this.nanoseconds+")"}toJSON(){return{type:n._jsonSchemaVersion,seconds:this.seconds,nanoseconds:this.nanoseconds}}static fromJSON(e){if(oe(e,n._jsonSchema))return new n(e.seconds,e.nanoseconds)}valueOf(){let e=this.seconds-an;return String(e).padStart(12,"0")+"."+String(this.nanoseconds).padStart(9,"0")}};A._jsonSchemaVersion="firestore/timestamp/1.0",A._jsonSchema={type:P("string",A._jsonSchemaVersion),seconds:P("number"),nanoseconds:P("number")};function In(n){return(n?.mapValue?.fields||{}).__type__?.stringValue==="server_timestamp"}function Pn(n){let e=n.mapValue.fields.__previous_value__;return In(e)?Pn(e):e}function ee(n){let e=O(n.mapValue.fields.__local_write_time__.timestampValue);return new A(e.seconds,e.nanos)}var bn="__type__",Sn="__max__",le={fields:{__type__:{stringValue:Sn}}},Rn="__vector__",ge="value";function C(n){return"nullValue"in n?0:"booleanValue"in n?1:"integerValue"in n||"doubleValue"in n?2:"timestampValue"in n?3:"stringValue"in n?5:"bytesValue"in n?6:"referenceValue"in n?7:"geoPointValue"in n?8:"arrayValue"in n?9:"mapValue"in n?In(n)?4:(function(t){return(((t.mapValue||{}).fields||{}).__type__||{}).stringValue===Sn})(n)?9007199254740991:(function(t){return(t?.mapValue?.fields||{})[bn]?.stringValue===Rn})(n)?10:11:_(28295,{value:n})}function _e(n,e){if(n===e)return!0;let t=C(n);if(t!==C(e))return!1;switch(t){case 0:case 9007199254740991:return!0;case 1:return n.booleanValue===e.booleanValue;case 4:return ee(n).isEqual(ee(e));case 3:return(function(i,s){if(typeof i.timestampValue=="string"&&typeof s.timestampValue=="string"&&i.timestampValue.length===s.timestampValue.length)return i.timestampValue===s.timestampValue;let o=O(i.timestampValue),u=O(s.timestampValue);return o.seconds===u.seconds&&o.nanos===u.nanos})(n,e);case 5:return n.stringValue===e.stringValue;case 6:return(function(i,s){return Z(i.bytesValue).isEqual(Z(s.bytesValue))})(n,e);case 7:return n.referenceValue===e.referenceValue;case 8:return(function(i,s){return g(i.geoPointValue.latitude)===g(s.geoPointValue.latitude)&&g(i.geoPointValue.longitude)===g(s.geoPointValue.longitude)})(n,e);case 2:return(function(i,s){if("integerValue"in i&&"integerValue"in s)return g(i.integerValue)===g(s.integerValue);if("doubleValue"in i&&"doubleValue"in s){let o=g(i.doubleValue),u=g(s.doubleValue);return o===u?pe(o)===pe(u):isNaN(o)&&isNaN(u)}return!1})(n,e);case 9:return lr(n.arrayValue.values||[],e.arrayValue.values||[],_e);case 10:case 11:return(function(i,s){let o=i.mapValue.fields||{},u=s.mapValue.fields||{};if(on(o)!==on(u))return!1;for(let a in o)if(o.hasOwnProperty(a)&&(u[a]===void 0||!_e(o[a],u[a])))return!1;return!0})(n,e);default:return _(52216,{left:n})}}function te(n,e){return(n.values||[]).find((t=>_e(t,e)))!==void 0}function ye(n,e){if(n===e)return 0;let t=C(n),r=C(e);if(t!==r)return p(t,r);switch(t){case 0:case 9007199254740991:return 0;case 1:return p(n.booleanValue,e.booleanValue);case 2:return(function(s,o){let u=g(s.integerValue||s.doubleValue),a=g(o.integerValue||o.doubleValue);return u<a?-1:u>a?1:u===a?0:isNaN(u)?isNaN(a)?0:-1:1})(n,e);case 3:return ln(n.timestampValue,e.timestampValue);case 4:return ln(ee(n),ee(e));case 5:return He(n.stringValue,e.stringValue);case 6:return(function(s,o){let u=Z(s),a=Z(o);return u.compareTo(a)})(n.bytesValue,e.bytesValue);case 7:return(function(s,o){let u=s.split("/"),a=o.split("/");for(let l=0;l<u.length&&l<a.length;l++){let h=p(u[l],a[l]);if(h!==0)return h}return p(u.length,a.length)})(n.referenceValue,e.referenceValue);case 8:return(function(s,o){let u=p(g(s.latitude),g(o.latitude));return u!==0?u:p(g(s.longitude),g(o.longitude))})(n.geoPointValue,e.geoPointValue);case 9:return cn(n.arrayValue,e.arrayValue);case 10:return(function(s,o){let u=s.fields||{},a=o.fields||{},l=u[ge]?.arrayValue,h=a[ge]?.arrayValue,m=p(l?.values?.length||0,h?.values?.length||0);return m!==0?m:cn(l,h)})(n.mapValue,e.mapValue);case 11:return(function(s,o){if(s===le&&o===le)return 0;if(s===le)return 1;if(o===le)return-1;let u=s.fields||{},a=Object.keys(u),l=o.fields||{},h=Object.keys(l);a.sort(),h.sort();for(let m=0;m<a.length&&m<h.length;++m){let V=He(a[m],h[m]);if(V!==0)return V;let K=ye(u[a[m]],l[h[m]]);if(K!==0)return K}return p(a.length,h.length)})(n.mapValue,e.mapValue);default:throw _(23264,{C:t})}}function ln(n,e){if(typeof n=="string"&&typeof e=="string"&&n.length===e.length)return p(n,e);let t=O(n),r=O(e),i=p(t.seconds,r.seconds);return i!==0?i:p(t.nanos,r.nanos)}function cn(n,e){let t=n.values||[],r=e.values||[];for(let i=0;i<t.length&&i<r.length;++i){let s=ye(t[i],r[i]);if(s)return s}return p(t.length,r.length)}function hn(n,e){return{referenceValue:`projects/${n.projectId}/databases/${n.database}/documents/${e.path.canonicalString()}`}}function kn(n){return!!n&&"arrayValue"in n}function dn(n){return!!n&&"nullValue"in n}function fn(n){return!!n&&"doubleValue"in n&&isNaN(Number(n.doubleValue))}function $e(n){return!!n&&"mapValue"in n}function H(n){if(n.geoPointValue)return{geoPointValue:{...n.geoPointValue}};if(n.timestampValue&&typeof n.timestampValue=="object")return{timestampValue:{...n.timestampValue}};if(n.mapValue){let e={mapValue:{fields:{}}};return De(n.mapValue.fields,((t,r)=>e.mapValue.fields[t]=H(r))),e}if(n.arrayValue){let e={arrayValue:{values:[]}};for(let t=0;t<(n.arrayValue.values||[]).length;++t)e.arrayValue.values[t]=H(n.arrayValue.values[t]);return e}return{...n}}var we=class{constructor(e,t){this.position=e,this.inclusive=t}};var Te=class{},b=class n extends Te{constructor(e,t,r){super(),this.field=e,this.op=t,this.value=r}static create(e,t,r){return e.isKeyField()?t==="in"||t==="not-in"?this.createKeyFieldInFilter(e,t,r):new et(e,t,r):t==="array-contains"?new rt(e,r):t==="in"?new it(e,r):t==="not-in"?new st(e,r):t==="array-contains-any"?new ot(e,r):new n(e,t,r)}static createKeyFieldInFilter(e,t,r){return t==="in"?new tt(e,r):new nt(e,r)}matches(e){let t=e.data.field(this.field);return this.op==="!="?t!==null&&t.nullValue===void 0&&this.matchesComparison(ye(t,this.value)):t!==null&&C(this.value)===C(t)&&this.matchesComparison(ye(t,this.value))}matchesComparison(e){switch(this.op){case"<":return e<0;case"<=":return e<=0;case"==":return e===0;case"!=":return e!==0;case">":return e>0;case">=":return e>=0;default:return _(47266,{operator:this.op})}}isInequality(){return["<","<=",">",">=","!=","not-in"].indexOf(this.op)>=0}getFlattenedFilters(){return[this]}getFilters(){return[this]}},ne=class n extends Te{constructor(e,t){super(),this.filters=e,this.op=t,this.N=null}static create(e,t){return new n(e,t)}matches(e){return(function(r){return r.op==="and"})(this)?this.filters.find((t=>!t.matches(e)))===void 0:this.filters.find((t=>t.matches(e)))!==void 0}getFlattenedFilters(){return this.N!==null||(this.N=this.filters.reduce(((e,t)=>e.concat(t.getFlattenedFilters())),[])),this.N}getFilters(){return Object.assign([],this.filters)}};var et=class extends b{constructor(e,t,r){super(e,t,r),this.key=E.fromName(r.referenceValue)}matches(e){let t=E.comparator(e.key,this.key);return this.matchesComparison(t)}},tt=class extends b{constructor(e,t){super(e,"in",t),this.keys=Nn("in",t)}matches(e){return this.keys.some((t=>t.isEqual(e.key)))}},nt=class extends b{constructor(e,t){super(e,"not-in",t),this.keys=Nn("not-in",t)}matches(e){return!this.keys.some((t=>t.isEqual(e.key)))}};function Nn(n,e){return(e.arrayValue?.values||[]).map((t=>E.fromName(t.referenceValue)))}var rt=class extends b{constructor(e,t){super(e,"array-contains",t)}matches(e){let t=e.data.field(this.field);return kn(t)&&te(t.arrayValue,this.value)}},it=class extends b{constructor(e,t){super(e,"in",t)}matches(e){let t=e.data.field(this.field);return t!==null&&te(this.value.arrayValue,t)}},st=class extends b{constructor(e,t){super(e,"not-in",t)}matches(e){if(te(this.value.arrayValue,{nullValue:"NULL_VALUE"}))return!1;let t=e.data.field(this.field);return t!==null&&t.nullValue===void 0&&!te(this.value.arrayValue,t)}},ot=class extends b{constructor(e,t){super(e,"array-contains-any",t)}matches(e){let t=e.data.field(this.field);return!(!kn(t)||!t.arrayValue.values)&&t.arrayValue.values.some((r=>te(this.value.arrayValue,r)))}};var re=class{constructor(e,t="asc"){this.field=e,this.dir=t}};var v=class n{static fromTimestamp(e){return new n(e)}static min(){return new n(new A(0,0))}static max(){return new n(new A(253402300799,999999999))}constructor(e){this.timestamp=e}compareTo(e){return this.timestamp._compareTo(e.timestamp)}isEqual(e){return this.timestamp.isEqual(e.timestamp)}toMicroseconds(){return 1e6*this.timestamp.seconds+this.timestamp.nanoseconds/1e3}toString(){return"SnapshotVersion("+this.timestamp.toString()+")"}toTimestamp(){return this.timestamp}};var at=class n{constructor(e,t){this.comparator=e,this.root=t||S.EMPTY}insert(e,t){return new n(this.comparator,this.root.insert(e,t,this.comparator).copy(null,null,S.BLACK,null,null))}remove(e){return new n(this.comparator,this.root.remove(e,this.comparator).copy(null,null,S.BLACK,null,null))}get(e){let t=this.root;for(;!t.isEmpty();){let r=this.comparator(e,t.key);if(r===0)return t.value;r<0?t=t.left:r>0&&(t=t.right)}return null}indexOf(e){let t=0,r=this.root;for(;!r.isEmpty();){let i=this.comparator(e,r.key);if(i===0)return t+r.left.size;i<0?r=r.left:(t+=r.left.size+1,r=r.right)}return-1}isEmpty(){return this.root.isEmpty()}get size(){return this.root.size}minKey(){return this.root.minKey()}maxKey(){return this.root.maxKey()}inorderTraversal(e){return this.root.inorderTraversal(e)}forEach(e){this.inorderTraversal(((t,r)=>(e(t,r),!1)))}toString(){let e=[];return this.inorderTraversal(((t,r)=>(e.push(`${t}:${r}`),!1))),`{${e.join(", ")}}`}reverseTraversal(e){return this.root.reverseTraversal(e)}getIterator(){return new U(this.root,null,this.comparator,!1)}getIteratorFrom(e){return new U(this.root,e,this.comparator,!1)}getReverseIterator(){return new U(this.root,null,this.comparator,!0)}getReverseIteratorFrom(e){return new U(this.root,e,this.comparator,!0)}},U=class{constructor(e,t,r,i){this.isReverse=i,this.nodeStack=[];let s=1;for(;!e.isEmpty();)if(s=t?r(e.key,t):1,t&&i&&(s*=-1),s<0)e=this.isReverse?e.left:e.right;else{if(s===0){this.nodeStack.push(e);break}this.nodeStack.push(e),e=this.isReverse?e.right:e.left}}getNext(){let e=this.nodeStack.pop(),t={key:e.key,value:e.value};if(this.isReverse)for(e=e.left;!e.isEmpty();)this.nodeStack.push(e),e=e.right;else for(e=e.right;!e.isEmpty();)this.nodeStack.push(e),e=e.left;return t}hasNext(){return this.nodeStack.length>0}peek(){if(this.nodeStack.length===0)return null;let e=this.nodeStack[this.nodeStack.length-1];return{key:e.key,value:e.value}}},S=class n{constructor(e,t,r,i,s){this.key=e,this.value=t,this.color=r??n.RED,this.left=i??n.EMPTY,this.right=s??n.EMPTY,this.size=this.left.size+1+this.right.size}copy(e,t,r,i,s){return new n(e??this.key,t??this.value,r??this.color,i??this.left,s??this.right)}isEmpty(){return!1}inorderTraversal(e){return this.left.inorderTraversal(e)||e(this.key,this.value)||this.right.inorderTraversal(e)}reverseTraversal(e){return this.right.reverseTraversal(e)||e(this.key,this.value)||this.left.reverseTraversal(e)}min(){return this.left.isEmpty()?this:this.left.min()}minKey(){return this.min().key}maxKey(){return this.right.isEmpty()?this.key:this.right.maxKey()}insert(e,t,r){let i=this,s=r(e,i.key);return i=s<0?i.copy(null,null,null,i.left.insert(e,t,r),null):s===0?i.copy(null,t,null,null,null):i.copy(null,null,null,null,i.right.insert(e,t,r)),i.fixUp()}removeMin(){if(this.left.isEmpty())return n.EMPTY;let e=this;return e.left.isRed()||e.left.left.isRed()||(e=e.moveRedLeft()),e=e.copy(null,null,null,e.left.removeMin(),null),e.fixUp()}remove(e,t){let r,i=this;if(t(e,i.key)<0)i.left.isEmpty()||i.left.isRed()||i.left.left.isRed()||(i=i.moveRedLeft()),i=i.copy(null,null,null,i.left.remove(e,t),null);else{if(i.left.isRed()&&(i=i.rotateRight()),i.right.isEmpty()||i.right.isRed()||i.right.left.isRed()||(i=i.moveRedRight()),t(e,i.key)===0){if(i.right.isEmpty())return n.EMPTY;r=i.right.min(),i=i.copy(r.key,r.value,null,null,i.right.removeMin())}i=i.copy(null,null,null,null,i.right.remove(e,t))}return i.fixUp()}isRed(){return this.color}fixUp(){let e=this;return e.right.isRed()&&!e.left.isRed()&&(e=e.rotateLeft()),e.left.isRed()&&e.left.left.isRed()&&(e=e.rotateRight()),e.left.isRed()&&e.right.isRed()&&(e=e.colorFlip()),e}moveRedLeft(){let e=this.colorFlip();return e.right.left.isRed()&&(e=e.copy(null,null,null,null,e.right.rotateRight()),e=e.rotateLeft(),e=e.colorFlip()),e}moveRedRight(){let e=this.colorFlip();return e.left.left.isRed()&&(e=e.rotateRight(),e=e.colorFlip()),e}rotateLeft(){let e=this.copy(null,null,n.RED,null,this.right.left);return this.right.copy(null,null,this.color,e,null)}rotateRight(){let e=this.copy(null,null,n.RED,this.left.right,null);return this.left.copy(null,null,this.color,null,e)}colorFlip(){let e=this.left.copy(null,null,!this.left.color,null,null),t=this.right.copy(null,null,!this.right.color,null,null);return this.copy(null,null,!this.color,e,t)}checkMaxDepth(){let e=this.check();return Math.pow(2,e)<=this.size+1}check(){if(this.isRed()&&this.left.isRed())throw _(43730,{key:this.key,value:this.value});if(this.right.isRed())throw _(14113,{key:this.key,value:this.value});let e=this.left.check();if(e!==this.right.check())throw _(27949);return e+(this.isRed()?0:1)}};S.EMPTY=null,S.RED=!0,S.BLACK=!1;S.EMPTY=new class{constructor(){this.size=0}get key(){throw _(57766)}get value(){throw _(16141)}get color(){throw _(16727)}get left(){throw _(29726)}get right(){throw _(36894)}copy(e,t,r,i,s){return this}insert(e,t,r){return new S(e,t)}remove(e,t){return this}isEmpty(){return!0}inorderTraversal(e){return!1}reverseTraversal(e){return!1}minKey(){return null}maxKey(){return null}isRed(){return!1}checkMaxDepth(){return!0}check(){return 0}};var ut=class n{constructor(e){this.comparator=e,this.data=new at(this.comparator)}has(e){return this.data.get(e)!==null}first(){return this.data.minKey()}last(){return this.data.maxKey()}get size(){return this.data.size}indexOf(e){return this.data.indexOf(e)}forEach(e){this.data.inorderTraversal(((t,r)=>(e(t),!1)))}forEachInRange(e,t){let r=this.data.getIteratorFrom(e[0]);for(;r.hasNext();){let i=r.getNext();if(this.comparator(i.key,e[1])>=0)return;t(i.key)}}forEachWhile(e,t){let r;for(r=t!==void 0?this.data.getIteratorFrom(t):this.data.getIterator();r.hasNext();)if(!e(r.getNext().key))return}firstAfterOrEqual(e){let t=this.data.getIteratorFrom(e);return t.hasNext()?t.getNext().key:null}getIterator(){return new ve(this.data.getIterator())}getIteratorFrom(e){return new ve(this.data.getIteratorFrom(e))}add(e){return this.copy(this.data.remove(e).insert(e,!0))}delete(e){return this.has(e)?this.copy(this.data.remove(e)):this}isEmpty(){return this.data.isEmpty()}unionWith(e){let t=this;return t.size<e.size&&(t=e,e=this),e.forEach((r=>{t=t.add(r)})),t}isEqual(e){if(!(e instanceof n)||this.size!==e.size)return!1;let t=this.data.getIterator(),r=e.data.getIterator();for(;t.hasNext();){let i=t.getNext().key,s=r.getNext().key;if(this.comparator(i,s)!==0)return!1}return!0}toArray(){let e=[];return this.forEach((t=>{e.push(t)})),e}toString(){let e=[];return this.forEach((t=>e.push(t))),"SortedSet("+e.toString()+")"}copy(e){let t=new n(this.comparator);return t.data=e,t}},ve=class{constructor(e){this.iter=e}getNext(){return this.iter.getNext().key}hasNext(){return this.iter.hasNext()}};var R=class n{constructor(e){this.value=e}static empty(){return new n({mapValue:{}})}field(e){if(e.isEmpty())return this.value;{let t=this.value;for(let r=0;r<e.length-1;++r)if(t=(t.mapValue.fields||{})[e.get(r)],!$e(t))return null;return t=(t.mapValue.fields||{})[e.lastSegment()],t||null}}set(e,t){this.getFieldsMap(e.popLast())[e.lastSegment()]=H(t)}setAll(e){let t=k.emptyPath(),r={},i=[];e.forEach(((o,u)=>{if(!t.isImmediateParentOf(u)){let a=this.getFieldsMap(t);this.applyChanges(a,r,i),r={},i=[],t=u.popLast()}o?r[u.lastSegment()]=H(o):i.push(u.lastSegment())}));let s=this.getFieldsMap(t);this.applyChanges(s,r,i)}delete(e){let t=this.field(e.popLast());$e(t)&&t.mapValue.fields&&delete t.mapValue.fields[e.lastSegment()]}isEqual(e){return _e(this.value,e.value)}getFieldsMap(e){let t=this.value;t.mapValue.fields||(t.mapValue={fields:{}});for(let r=0;r<e.length;++r){let i=t.mapValue.fields[e.get(r)];$e(i)&&i.mapValue.fields||(i={mapValue:{fields:{}}},t.mapValue.fields[e.get(r)]=i),t=i}return t.mapValue.fields}applyChanges(e,t,r){De(t,((i,s)=>e[i]=s));for(let i of r)delete e[i]}clone(){return new n(H(this.value))}};var ie=class n{constructor(e,t,r,i,s,o,u){this.key=e,this.documentType=t,this.version=r,this.readTime=i,this.createTime=s,this.data=o,this.documentState=u}static newInvalidDocument(e){return new n(e,0,v.min(),v.min(),v.min(),R.empty(),0)}static newFoundDocument(e,t,r,i){return new n(e,1,t,v.min(),r,i,0)}static newNoDocument(e,t){return new n(e,2,t,v.min(),v.min(),R.empty(),0)}static newUnknownDocument(e,t){return new n(e,3,t,v.min(),v.min(),R.empty(),2)}convertToFoundDocument(e,t){return!this.createTime.isEqual(v.min())||this.documentType!==2&&this.documentType!==0||(this.createTime=e),this.version=e,this.documentType=1,this.data=t,this.documentState=0,this}convertToNoDocument(e){return this.version=e,this.documentType=2,this.data=R.empty(),this.documentState=0,this}convertToUnknownDocument(e){return this.version=e,this.documentType=3,this.data=R.empty(),this.documentState=2,this}setHasCommittedMutations(){return this.documentState=2,this}setHasLocalMutations(){return this.documentState=1,this.version=v.min(),this}setReadTime(e){return this.readTime=e,this}get hasLocalMutations(){return this.documentState===1}get hasCommittedMutations(){return this.documentState===2}get hasPendingWrites(){return this.hasLocalMutations||this.hasCommittedMutations}isValidDocument(){return this.documentType!==0}isFoundDocument(){return this.documentType===1}isNoDocument(){return this.documentType===2}isUnknownDocument(){return this.documentType===3}isEqual(e){return e instanceof n&&this.key.isEqual(e.key)&&this.version.isEqual(e.version)&&this.documentType===e.documentType&&this.documentState===e.documentState&&this.data.isEqual(e.data)}mutableCopy(){return new n(this.key,this.documentType,this.version,this.readTime,this.createTime,this.data.clone(),this.documentState)}toString(){return`Document(${this.key}, ${this.version}, ${JSON.stringify(this.data.value)}, {createTime: ${this.createTime}}), {documentType: ${this.documentType}}), {documentState: ${this.documentState}})`}};var lt=class{constructor(e,t=null,r=[],i=[],s=null,o=null,u=null){this.path=e,this.collectionGroup=t,this.orderBy=r,this.filters=i,this.limit=s,this.startAt=o,this.endAt=u,this.O=null}};function mn(n,e=null,t=[],r=[],i=null,s=null,o=null){return new lt(n,e,t,r,i,s,o)}var Ee=class{constructor(e,t=null,r=[],i=[],s=null,o="F",u=null,a=null){this.path=e,this.collectionGroup=t,this.explicitOrderBy=r,this.filters=i,this.limit=s,this.limitType=o,this.startAt=u,this.endAt=a,this.q=null,this.B=null,this.$=null,this.startAt,this.endAt}};function pr(n){return n.collectionGroup!==null}function gr(n){let e=ke(n);if(e.q===null){e.q=[];let t=new Set;for(let s of e.explicitOrderBy)e.q.push(s),t.add(s.field.canonicalString());let r=e.explicitOrderBy.length>0?e.explicitOrderBy[e.explicitOrderBy.length-1].dir:"asc";(function(o){let u=new ut(k.comparator);return o.filters.forEach((a=>{a.getFlattenedFilters().forEach((l=>{l.isInequality()&&(u=u.add(l.field))}))})),u})(e).forEach((s=>{t.has(s.canonicalString())||s.isKeyField()||e.q.push(new re(s,r))})),t.has(k.keyField().canonicalString())||e.q.push(new re(k.keyField(),r))}return e.q}function _r(n){let e=ke(n);return e.B||(e.B=yr(e,gr(n))),e.B}function yr(n,e){if(n.limitType==="F")return mn(n.path,n.collectionGroup,e,n.filters,n.limit,n.startAt,n.endAt);{e=e.map((i=>{let s=i.dir==="desc"?"asc":"desc";return new re(i.field,s)}));let t=n.endAt?new we(n.endAt.position,n.endAt.inclusive):null,r=n.startAt?new we(n.startAt.position,n.startAt.inclusive):null;return mn(n.path,n.collectionGroup,e,n.filters,n.limit,t,r)}}function ct(n,e){let t=n.filters.concat([e]);return new Ee(n.path,n.collectionGroup,n.explicitOrderBy.slice(),t,n.limit,n.limitType,n.startAt,n.endAt)}function Dn(n,e){if(n.useProto3Json){if(isNaN(e))return{doubleValue:"NaN"};if(e===1/0)return{doubleValue:"Infinity"};if(e===-1/0)return{doubleValue:"-Infinity"}}return{doubleValue:pe(e)?"-0":e}}function wr(n,e){return(function(r){return typeof r=="number"&&Number.isInteger(r)&&!pe(r)&&r<=Number.MAX_SAFE_INTEGER&&r>=Number.MIN_SAFE_INTEGER})(e)?(function(r){return{integerValue:""+r}})(e):Dn(n,e)}var Tr={asc:"ASCENDING",desc:"DESCENDING"},vr={"<":"LESS_THAN","<=":"LESS_THAN_OR_EQUAL",">":"GREATER_THAN",">=":"GREATER_THAN_OR_EQUAL","==":"EQUAL","!=":"NOT_EQUAL","array-contains":"ARRAY_CONTAINS",in:"IN","not-in":"NOT_IN","array-contains-any":"ARRAY_CONTAINS_ANY"},Er={and:"AND",or:"OR"},ht=class{constructor(e,t){this.databaseId=e,this.useProto3Json=t}};function pn(n,e){return n.useProto3Json?`${new Date(1e3*e.seconds).toISOString().replace(/\.\d*/,"").replace("Z","")}.${("000000000"+e.nanoseconds).slice(-9)}Z`:{seconds:""+e.seconds,nanos:e.nanoseconds}}function Vr(n,e){return n.useProto3Json?e.toBase64():e.toUint8Array()}function Y(n){return I(!!n,49232),v.fromTimestamp((function(t){let r=O(t);return new A(r.seconds,r.nanos)})(n))}function Pt(n,e){return dt(n,e).canonicalString()}function dt(n,e){let t=(function(i){return new y(["projects",i.projectId,"databases",i.database])})(n).child("documents");return e===void 0?t:t.child(e)}function Ar(n,e){return Pt(n.databaseId,e.path)}function ft(n,e){let t=(function(i){let s=y.fromString(i);return I(xn(s),10190,{key:s.toString()}),s})(e);if(t.get(1)!==n.databaseId.projectId)throw new c(d,"Tried to deserialize key from different project: "+t.get(1)+" vs "+n.databaseId.projectId);if(t.get(3)!==n.databaseId.database)throw new c(d,"Tried to deserialize key from different database: "+t.get(3)+" vs "+n.databaseId.database);return new E((function(i){return I(i.length>4&&i.get(4)==="documents",29091,{key:i.toString()}),i.popFirst(5)})(t))}function Ir(n,e){return"found"in e?(function(r,i){I(!!i.found,43571),i.found.name,i.found.updateTime;let s=ft(r,i.found.name),o=Y(i.found.updateTime),u=i.found.createTime?Y(i.found.createTime):v.min(),a=new R({mapValue:{fields:i.found.fields}});return ie.newFoundDocument(s,o,u,a)})(n,e):"missing"in e?(function(r,i){I(!!i.missing,3894),I(!!i.readTime,22933);let s=ft(r,i.missing),o=Y(i.readTime);return ie.newNoDocument(s,o)})(n,e):_(7234,{result:e})}function Pr(n,e){let t={structuredQuery:{}},r=e.path,i;e.collectionGroup!==null?(i=r,t.structuredQuery.from=[{collectionId:e.collectionGroup,allDescendants:!0}]):(i=r.popLast(),t.structuredQuery.from=[{collectionId:r.lastSegment()}]),t.parent=(function(l,h){return Pt(l.databaseId,h)})(n,i);let s=(function(l){if(l.length!==0)return Fn(ne.create(l,"and"))})(e.filters);s&&(t.structuredQuery.where=s);let o=(function(l){if(l.length!==0)return l.map((h=>(function(V){return{field:M(V.field),direction:br(V.dir)}})(h)))})(e.orderBy);o&&(t.structuredQuery.orderBy=o);let u=(function(l,h){return l.useProto3Json||dr(h)?h:{value:h}})(n,e.limit);return u!==null&&(t.structuredQuery.limit=u),e.startAt&&(t.structuredQuery.startAt=(function(l){return{before:l.inclusive,values:l.position}})(e.startAt)),e.endAt&&(t.structuredQuery.endAt=(function(l){return{before:!l.inclusive,values:l.position}})(e.endAt)),{M:t,parent:i}}function br(n){return Tr[n]}function Sr(n){return vr[n]}function Rr(n){return Er[n]}function M(n){return{fieldPath:n.canonicalString()}}function Fn(n){return n instanceof b?(function(t){if(t.op==="=="){if(fn(t.value))return{unaryFilter:{field:M(t.field),op:"IS_NAN"}};if(dn(t.value))return{unaryFilter:{field:M(t.field),op:"IS_NULL"}}}else if(t.op==="!="){if(fn(t.value))return{unaryFilter:{field:M(t.field),op:"IS_NOT_NAN"}};if(dn(t.value))return{unaryFilter:{field:M(t.field),op:"IS_NOT_NULL"}}}return{fieldFilter:{field:M(t.field),op:Sr(t.op),value:t.value}}})(n):n instanceof ne?(function(t){let r=t.getFilters().map((i=>Fn(i)));return r.length===1?r[0]:{compositeFilter:{op:Rr(t.op),filters:r}}})(n):_(54877,{filter:n})}function xn(n){return n.length>=4&&n.get(0)==="projects"&&n.get(2)==="databases"}function bt(n){return new ht(n,!0)}var mt=class{},pt=class extends mt{constructor(e,t,r,i){super(),this.authCredentials=e,this.appCheckCredentials=t,this.connection=r,this.serializer=i,this.et=!1}rt(){if(this.et)throw new c(B,"The client has already been terminated.")}I(e,t,r,i){return this.rt(),Promise.all([this.authCredentials.getToken(),this.appCheckCredentials.getToken()]).then((([s,o])=>this.connection.I(e,dt(t,r),i,s,o))).catch((s=>{throw s.name==="FirebaseError"?(s.code===Me&&(this.authCredentials.invalidateToken(),this.appCheckCredentials.invalidateToken()),s):new c(J,s.toString())}))}D(e,t,r,i,s){return this.rt(),Promise.all([this.authCredentials.getToken(),this.appCheckCredentials.getToken()]).then((([o,u])=>this.connection.D(e,dt(t,r),i,o,u,s))).catch((o=>{throw o.name==="FirebaseError"?(o.code===Me&&(this.authCredentials.invalidateToken(),this.appCheckCredentials.invalidateToken()),o):new c(J,o.toString())}))}terminate(){this.et=!0,this.connection.terminate()}};async function kr(n,e){let t=ke(n),r={documents:e.map((u=>Ar(t.serializer,u)))},i=await t.D("BatchGetDocuments",t.serializer.databaseId,y.emptyPath(),r,e.length),s=new Map;i.forEach((u=>{let a=Ir(t.serializer,u);s.set(a.key.toString(),a)}));let o=[];return e.forEach((u=>{let a=s.get(u.toString());I(!!a,55234,{key:u}),o.push(a)})),o}async function Nr(n,e){let t=ke(n),{M:r,parent:i}=Pr(t.serializer,_r(e));return(await t.D("RunQuery",t.serializer.databaseId,i,{structuredQuery:r.structuredQuery})).filter((s=>!!s.document)).map((s=>(function(u,a,l){let h=ft(u,a.name),m=Y(a.updateTime),V=a.createTime?Y(a.createTime):v.min(),K=new R({mapValue:{fields:a.fields}}),L=ie.newFoundDocument(h,m,V,K);return l&&L.setHasCommittedMutations(),l?L.setHasCommittedMutations():L})(t.serializer,s.document,void 0)))}var qn="ComponentProvider",X=new Map;function On(n){if(n._terminated)throw new c(B,"The client has already been terminated.");if(!X.has(n)){ce(qn,"Initializing Datastore");let e=(function(s){return new Xe(s)})((function(s,o,u,a){return new Ke(s,o,u,a.host,a.ssl,a.experimentalForceLongPolling,a.experimentalAutoDetectLongPolling,An(a.experimentalLongPollingOptions),a.useFetchStreams,a.isUsingEmulator)})(n._databaseId,n.app.options.appId||"",n._persistenceKey,n._freezeSettings())),t=bt(n._databaseId),r=(function(s,o,u,a){return new pt(s,o,u,a)})(n._authCredentials,n._appCheckCredentials,e,t);X.set(n,r)}return X.get(n)}var Dr=1048576,Cn="firestore.googleapis.com",gn=!0;var Ve=class{constructor(e){if(e.host===void 0){if(e.ssl!==void 0)throw new c(d,"Can't provide ssl option if host option is not set");this.host=Cn,this.ssl=gn}else this.host=e.host,this.ssl=e.ssl??gn;if(this.isUsingEmulator=e.emulatorOptions!==void 0,this.credentials=e.credentials,this.ignoreUndefinedProperties=!!e.ignoreUndefinedProperties,this.localCache=e.localCache,e.cacheSizeBytes===void 0)this.cacheSizeBytes=41943040;else{if(e.cacheSizeBytes!==-1&&e.cacheSizeBytes<Dr)throw new c(d,"cacheSizeBytes must be at least 1048576");this.cacheSizeBytes=e.cacheSizeBytes}(function(r,i,s,o){if(i===!0&&o===!0)throw new c(d,`${r} and ${s} cannot be used together.`)})("experimentalForceLongPolling",e.experimentalForceLongPolling,"experimentalAutoDetectLongPolling",e.experimentalAutoDetectLongPolling),this.experimentalForceLongPolling=!!e.experimentalForceLongPolling,this.experimentalForceLongPolling?this.experimentalAutoDetectLongPolling=!1:e.experimentalAutoDetectLongPolling===void 0?this.experimentalAutoDetectLongPolling=!0:this.experimentalAutoDetectLongPolling=!!e.experimentalAutoDetectLongPolling,this.experimentalLongPollingOptions=An(e.experimentalLongPollingOptions??{}),(function(r){if(r.timeoutSeconds!==void 0){if(isNaN(r.timeoutSeconds))throw new c(d,`invalid long polling timeout: ${r.timeoutSeconds} (must not be NaN)`);if(r.timeoutSeconds<5)throw new c(d,`invalid long polling timeout: ${r.timeoutSeconds} (minimum allowed value is 5)`);if(r.timeoutSeconds>30)throw new c(d,`invalid long polling timeout: ${r.timeoutSeconds} (maximum allowed value is 30)`)}})(this.experimentalLongPollingOptions),this.useFetchStreams=!!e.useFetchStreams}isEqual(e){return this.host===e.host&&this.ssl===e.ssl&&this.credentials===e.credentials&&this.cacheSizeBytes===e.cacheSizeBytes&&this.experimentalForceLongPolling===e.experimentalForceLongPolling&&this.experimentalAutoDetectLongPolling===e.experimentalAutoDetectLongPolling&&(function(r,i){return r.timeoutSeconds===i.timeoutSeconds})(this.experimentalLongPollingOptions,e.experimentalLongPollingOptions)&&this.ignoreUndefinedProperties===e.ignoreUndefinedProperties&&this.useFetchStreams===e.useFetchStreams}},z=class{constructor(e,t,r,i){this._authCredentials=e,this._appCheckCredentials=t,this._databaseId=r,this._app=i,this.type="firestore-lite",this._persistenceKey="(lite)",this._settings=new Ve({}),this._settingsFrozen=!1,this._emulatorOptions={},this._terminateTask="notTerminated"}get app(){if(!this._app)throw new c(B,"Firestore was not initialized using the Firebase SDK. 'app' is not available");return this._app}get _initialized(){return this._settingsFrozen}get _terminated(){return this._terminateTask!=="notTerminated"}_setSettings(e){if(this._settingsFrozen)throw new c(B,"Firestore has already been started and its settings can no longer be changed. You can only modify settings before calling any other methods on a Firestore object.");this._settings=new Ve(e),this._emulatorOptions=e.emulatorOptions||{},e.credentials!==void 0&&(this._authCredentials=(function(r){if(!r)return new Ue;switch(r.type){case"firstParty":return new Ge(r.sessionIndex||"0",r.iamToken||null,r.authTokenFactory||null);case"provider":return r.client;default:throw new c(d,"makeAuthCredentialsProvider failed due to invalid credential type")}})(e.credentials))}_getSettings(){return this._settings}_getEmulatorOptions(){return this._emulatorOptions}_freezeSettings(){return this._settingsFrozen=!0,this._settings}_delete(){return this._terminateTask==="notTerminated"&&(this._terminateTask=this._terminate()),this._terminateTask}async _restart(){this._terminateTask==="notTerminated"?await this._terminate():this._terminateTask="notTerminated"}toJSON(){return{app:this._app,databaseId:this._databaseId,settings:this._settings}}_terminate(){return(function(t){let r=X.get(t);r&&(ce(qn,"Removing Datastore"),X.delete(t),r.terminate())})(this),Promise.resolve()}};function Ln(n,e){let t=typeof n=="object"?n:Gt(),r=typeof n=="string"?n:e||"(default)",i=jt(t,"firestore/lite").getImmediate({identifier:r});if(!i._initialized){let s=Ft("firestore");s&&Fr(i,...s)}return i}function Fr(n,e,t,r={}){n=It(n,z);let i=xe(e),s=n._getSettings(),o={...s,emulatorOptions:n._getEmulatorOptions()},u=`${e}:${t}`;i&&(xt(`https://${u}`),Ot("Firestore",!0)),s.host!==Cn&&s.host!==u&&wn("Host has been set in both settings() and connectFirestoreEmulator(), emulator host will be used.");let a={...s,host:u,ssl:i,emulatorOptions:r};if(!Lt(a,o)&&(n._setSettings(a),r.mockUserToken)){let l,h;if(typeof r.mockUserToken=="string")l=r.mockUserToken,h=w.MOCK_USER;else{l=qt(r.mockUserToken,n._app?.options.projectId);let m=r.mockUserToken.sub||r.mockUserToken.user_id;if(!m)throw new c(d,"mockUserToken must contain 'sub' or 'user_id' field!");h=new w(m)}n._authCredentials=new je(new he(l,h))}}var G=class n{constructor(e,t,r){this.converter=t,this._query=r,this.type="query",this.firestore=e}withConverter(e){return new n(this.firestore,e,this._query)}},T=class n{constructor(e,t,r){this.converter=t,this._key=r,this.type="document",this.firestore=e}get _path(){return this._key.path}get id(){return this._key.path.lastSegment()}get path(){return this._key.path.canonicalString()}get parent(){return new N(this.firestore,this.converter,this._key.path.popLast())}withConverter(e){return new n(this.firestore,e,this._key)}toJSON(){return{type:n._jsonSchemaVersion,referencePath:this._key.toString()}}static fromJSON(e,t,r){if(oe(t,n._jsonSchema))return new n(e,r||null,new E(y.fromString(t.referencePath)))}};T._jsonSchemaVersion="firestore/documentReference/1.0",T._jsonSchema={type:P("string",T._jsonSchemaVersion),referencePath:P("string")};var N=class n extends G{constructor(e,t,r){super(e,t,(function(s){return new Ee(s)})(r)),this._path=r,this.type="collection"}get id(){return this._query.path.lastSegment()}get path(){return this._query.path.canonicalString()}get parent(){let e=this._path.popLast();return e.isEmpty()?null:new T(this.firestore,null,new E(e))}withConverter(e){return new n(this.firestore,e,this._path)}};function $n(n,e,...t){if(n=$(n),En("collection","path",e),n instanceof z){let r=y.fromString(e,...t);return nn(r),new N(n,null,r)}{if(!(n instanceof T||n instanceof N))throw new c(d,"Expected first argument to collection() to be a CollectionReference, a DocumentReference or FirebaseFirestore");let r=n._path.child(y.fromString(e,...t));return nn(r),new N(n.firestore,null,r)}}function St(n,e,...t){if(n=$(n),arguments.length===1&&(e=Je.newId()),En("doc","path",e),n instanceof z){let r=y.fromString(e,...t);return tn(r),new T(n,null,new E(r))}{if(!(n instanceof T||n instanceof N))throw new c(d,"Expected first argument to collection() to be a CollectionReference, a DocumentReference or FirebaseFirestore");let r=n._path.child(y.fromString(e,...t));return tn(r),new T(n.firestore,n instanceof N?n.converter:null,new E(r))}}var D=class n{constructor(e){this._byteString=e}static fromBase64String(e){try{return new n(q.fromBase64String(e))}catch(t){throw new c(d,"Failed to construct data from Base64 string: "+t)}}static fromUint8Array(e){return new n(q.fromUint8Array(e))}toBase64(){return this._byteString.toBase64()}toUint8Array(){return this._byteString.toUint8Array()}toString(){return"Bytes(base64: "+this.toBase64()+")"}isEqual(e){return this._byteString.isEqual(e._byteString)}toJSON(){return{type:n._jsonSchemaVersion,bytes:this.toBase64()}}static fromJSON(e){if(oe(e,n._jsonSchema))return n.fromBase64String(e.bytes)}};D._jsonSchemaVersion="firestore/bytes/1.0",D._jsonSchema={type:P("string",D._jsonSchemaVersion),bytes:P("string")};var Ae=class{constructor(...e){for(let t=0;t<e.length;++t)if(e[t].length===0)throw new c(d,"Invalid field name at argument $(i + 1). Field names must not be empty.");this._internalPath=new k(e)}isEqual(e){return this._internalPath.isEqual(e._internalPath)}};var Ie=class{constructor(e){this._methodName=e}};var F=class n{constructor(e,t){if(!isFinite(e)||e<-90||e>90)throw new c(d,"Latitude must be a number between -90 and 90, but was: "+e);if(!isFinite(t)||t<-180||t>180)throw new c(d,"Longitude must be a number between -180 and 180, but was: "+t);this._lat=e,this._long=t}get latitude(){return this._lat}get longitude(){return this._long}isEqual(e){return this._lat===e._lat&&this._long===e._long}_compareTo(e){return p(this._lat,e._lat)||p(this._long,e._long)}toJSON(){return{latitude:this._lat,longitude:this._long,type:n._jsonSchemaVersion}}static fromJSON(e){if(oe(e,n._jsonSchema))return new n(e.latitude,e.longitude)}};F._jsonSchemaVersion="firestore/geoPoint/1.0",F._jsonSchema={type:P("string",F._jsonSchemaVersion),latitude:P("number"),longitude:P("number")};var x=class n{constructor(e){this._values=(e||[]).map((t=>t))}toArray(){return this._values.map((e=>e))}isEqual(e){return(function(r,i){if(r.length!==i.length)return!1;for(let s=0;s<r.length;++s)if(r[s]!==i[s])return!1;return!0})(this._values,e._values)}toJSON(){return{type:n._jsonSchemaVersion,vectorValues:this._values}}static fromJSON(e){if(oe(e,n._jsonSchema)){if(Array.isArray(e.vectorValues)&&e.vectorValues.every((t=>typeof t=="number")))return new n(e.vectorValues);throw new c(d,"Expected 'vectorValues' field to be a number array")}}};x._jsonSchemaVersion="firestore/vectorValue/1.0",x._jsonSchema={type:P("string",x._jsonSchemaVersion),vectorValues:P("object")};var xr=/^__.*__$/;function Mn(n){switch(n){case 0:case 2:case 1:return!0;case 3:case 4:return!1;default:throw _(40011,{it:n})}}var gt=class n{constructor(e,t,r,i,s,o){this.settings=e,this.databaseId=t,this.serializer=r,this.ignoreUndefinedProperties=i,s===void 0&&this.st(),this.fieldTransforms=s||[],this.fieldMask=o||[]}get path(){return this.settings.path}get it(){return this.settings.it}ot(e){return new n({...this.settings,...e},this.databaseId,this.serializer,this.ignoreUndefinedProperties,this.fieldTransforms,this.fieldMask)}ut(e){let t=this.path?.child(e),r=this.ot({path:t,_t:!1});return r.ct(e),r}lt(e){let t=this.path?.child(e),r=this.ot({path:t,_t:!1});return r.st(),r}ht(e){return this.ot({path:void 0,_t:!0})}ft(e){return yt(e,this.settings.methodName,this.settings.dt||!1,this.path,this.settings.Et)}contains(e){return this.fieldMask.find((t=>e.isPrefixOf(t)))!==void 0||this.fieldTransforms.find((t=>e.isPrefixOf(t.field)))!==void 0}st(){if(this.path)for(let e=0;e<this.path.length;e++)this.ct(this.path.get(e))}ct(e){if(e.length===0)throw this.ft("Document fields must not be empty");if(Mn(this.it)&&xr.test(e))throw this.ft('Document fields cannot begin and end with "__"')}},_t=class{constructor(e,t,r){this.databaseId=e,this.ignoreUndefinedProperties=t,this.serializer=r||bt(e)}Tt(e,t,r,i=!1){return new gt({it:e,methodName:t,Et:r,path:k.emptyPath(),_t:!1,dt:i},this.databaseId,this.serializer,this.ignoreUndefinedProperties)}};function qr(n){let e=n._freezeSettings(),t=bt(n._databaseId);return new _t(n._databaseId,!!e.ignoreUndefinedProperties,t)}function Or(n,e,t,r=!1){return Rt(t,n.Tt(r?4:3,e))}function Rt(n,e){if(Un(n=$(n)))return Lr("Unsupported field value:",e,n),Cr(n,e);if(n instanceof Ie)return(function(r,i){if(!Mn(i.it))throw i.ft(`${r._methodName}() can only be used with update() and set()`);if(!i.path)throw i.ft(`${r._methodName}() is not currently supported inside arrays`);let s=r._toFieldTransform(i);s&&i.fieldTransforms.push(s)})(n,e),null;if(n===void 0&&e.ignoreUndefinedProperties)return null;if(e.path&&e.fieldMask.push(e.path),n instanceof Array){if(e.settings._t&&e.it!==4)throw e.ft("Nested arrays are not supported");return(function(r,i){let s=[],o=0;for(let u of r){let a=Rt(u,i.ht(o));a==null&&(a={nullValue:"NULL_VALUE"}),s.push(a),o++}return{arrayValue:{values:s}}})(n,e)}return(function(r,i){if((r=$(r))===null)return{nullValue:"NULL_VALUE"};if(typeof r=="number")return wr(i.serializer,r);if(typeof r=="boolean")return{booleanValue:r};if(typeof r=="string")return{stringValue:r};if(r instanceof Date){let s=A.fromDate(r);return{timestampValue:pn(i.serializer,s)}}if(r instanceof A){let s=new A(r.seconds,1e3*Math.floor(r.nanoseconds/1e3));return{timestampValue:pn(i.serializer,s)}}if(r instanceof F)return{geoPointValue:{latitude:r.latitude,longitude:r.longitude}};if(r instanceof D)return{bytesValue:Vr(i.serializer,r._byteString)};if(r instanceof T){let s=i.databaseId,o=r.firestore._databaseId;if(!o.isEqual(s))throw i.ft(`Document reference is for database ${o.projectId}/${o.database} but should be for database ${s.projectId}/${s.database}`);return{referenceValue:Pt(r.firestore._databaseId||i.databaseId,r._key.path)}}if(r instanceof x)return(function(o,u){return{mapValue:{fields:{[bn]:{stringValue:Rn},[ge]:{arrayValue:{values:o.toArray().map((l=>{if(typeof l!="number")throw u.ft("VectorValues must only contain numeric values.");return Dn(u.serializer,l)}))}}}}}})(r,i);throw i.ft(`Unsupported field value: ${Ne(r)}`)})(n,e)}function Cr(n,e){let t={};return(function(i){for(let s in i)if(Object.prototype.hasOwnProperty.call(i,s))return!1;return!0})(n)?e.path&&e.path.length>0&&e.fieldMask.push(e.path):De(n,((r,i)=>{let s=Rt(i,e.ut(r));s!=null&&(t[r]=s)})),{mapValue:{fields:t}}}function Un(n){return!(typeof n!="object"||n===null||n instanceof Array||n instanceof Date||n instanceof A||n instanceof F||n instanceof D||n instanceof T||n instanceof Ie||n instanceof x)}function Lr(n,e,t){if(!Un(t)||!Vn(t)){let r=Ne(t);throw r==="an object"?e.ft(n+" a custom object"):e.ft(n+" "+r)}}var $r=new RegExp("[~\\*/\\[\\]]");function Mr(n,e,t){if(e.search($r)>=0)throw yt(`Invalid field path (${e}). Paths must not contain '~', '*', '/', '[', or ']'`,n,!1,void 0,t);try{return new Ae(...e.split("."))._internalPath}catch{throw yt(`Invalid field path (${e}). Paths must not be empty, begin with '.', end with '.', or contain '..'`,n,!1,void 0,t)}}function yt(n,e,t,r,i){let s=r&&!r.isEmpty(),o=i!==void 0,u=`Function ${e}() called with invalid data`;t&&(u+=" (via `toFirestore()`)"),u+=". ";let a="";return(s||o)&&(a+=" (found",s&&(a+=` in field ${r}`),o&&(a+=` in document ${i}`),a+=")"),new c(d,u+n+a)}var Pe=class{constructor(e,t,r,i,s){this._firestore=e,this._userDataWriter=t,this._key=r,this._document=i,this._converter=s}get id(){return this._key.path.lastSegment()}get ref(){return new T(this._firestore,this._converter,this._key)}exists(){return this._document!==null}data(){if(this._document){if(this._converter){let e=new be(this._firestore,this._userDataWriter,this._key,this._document,null);return this._converter.fromFirestore(e)}return this._userDataWriter.convertValue(this._document.data.value)}}get(e){if(this._document){let t=this._document.data.field(jn("DocumentSnapshot.get",e));if(t!==null)return this._userDataWriter.convertValue(t)}}},be=class extends Pe{data(){return super.data()}},wt=class{constructor(e,t){this._docs=t,this.query=e}get docs(){return[...this._docs]}get size(){return this.docs.length}get empty(){return this.docs.length===0}forEach(e,t){this._docs.forEach(e,t)}};function jn(n,e){return typeof e=="string"?Mr(n,e):e instanceof Ae?e._internalPath:e._delegate._internalPath}var se=class{},Tt=class extends se{};function Bn(n,e,...t){let r=[];e instanceof se&&r.push(e),r=r.concat(t),(function(s){let o=s.filter((a=>a instanceof vt)).length,u=s.filter((a=>a instanceof Se)).length;if(o>1||o>0&&u>0)throw new c(d,"InvalidQuery. When using composite filters, you cannot use more than one filter at the top level. Consider nesting the multiple filters within an `and(...)` statement. For example: change `query(query, where(...), or(...))` to `query(query, and(where(...), or(...)))`.")})(r);for(let i of r)n=i._apply(n);return n}var Se=class n extends Tt{constructor(e,t,r){super(),this._field=e,this._op=t,this._value=r,this.type="where"}static _create(e,t,r){return new n(e,t,r)}_apply(e){let t=this._parse(e);return Gn(e._query,t),new G(e.firestore,e.converter,ct(e._query,t))}_parse(e){let t=qr(e.firestore);return(function(s,o,u,a,l,h,m){let V;if(l.isKeyField()){if(h==="array-contains"||h==="array-contains-any")throw new c(d,`Invalid Query. You can't perform '${h}' queries on documentId().`);if(h==="in"||h==="not-in"){yn(m,h);let L=[];for(let Hn of m)L.push(_n(a,s,Hn));V={arrayValue:{values:L}}}else V=_n(a,s,m)}else h!=="in"&&h!=="not-in"&&h!=="array-contains-any"||yn(m,h),V=Or(u,o,m,h==="in"||h==="not-in");return b.create(l,h,V)})(e._query,"where",t,e.firestore._databaseId,this._field,this._op,this._value)}};function zn(n,e,t){let r=e,i=jn("where",n);return Se._create(i,r,t)}var vt=class n extends se{constructor(e,t){super(),this.type=e,this._queryConstraints=t}static _create(e,t){return new n(e,t)}_parse(e){let t=this._queryConstraints.map((r=>r._parse(e))).filter((r=>r.getFilters().length>0));return t.length===1?t[0]:ne.create(t,this._getOperator())}_apply(e){let t=this._parse(e);return t.getFilters().length===0?e:((function(i,s){let o=i,u=s.getFlattenedFilters();for(let a of u)Gn(o,a),o=ct(o,a)})(e._query,t),new G(e.firestore,e.converter,ct(e._query,t)))}_getQueryConstraints(){return this._queryConstraints}_getOperator(){return this.type==="and"?"and":"or"}};function _n(n,e,t){if(typeof(t=$(t))=="string"){if(t==="")throw new c(d,"Invalid query. When querying with documentId(), you must provide a valid document ID, but it was an empty string.");if(!pr(e)&&t.indexOf("/")!==-1)throw new c(d,`Invalid query. When querying a collection by documentId(), you must provide a plain document ID, but '${t}' contains a '/' character.`);let r=e.path.child(y.fromString(t));if(!E.isDocumentKey(r))throw new c(d,`Invalid query. When querying a collection group by documentId(), the value provided must result in a valid document path, but '${r}' is not because it has an odd number of segments (${r.length}).`);return hn(n,new E(r))}if(t instanceof T)return hn(n,t._key);throw new c(d,`Invalid query. When querying with documentId(), you must provide a valid string or a DocumentReference, but it was: ${Ne(t)}.`)}function yn(n,e){if(!Array.isArray(n)||n.length===0)throw new c(d,`Invalid Query. A non-empty array is required for '${e.toString()}' filters.`)}function Gn(n,e){let t=(function(i,s){for(let o of i)for(let u of o.getFlattenedFilters())if(s.indexOf(u.op)>=0)return u.op;return null})(n.filters,(function(i){switch(i){case"!=":return["!=","not-in"];case"array-contains-any":case"in":return["not-in"];case"not-in":return["array-contains-any","in","not-in","!="];default:return[]}})(e.op));if(t!==null)throw t===e.op?new c(d,`Invalid query. You cannot use more than one '${e.op.toString()}' filter.`):new c(d,`Invalid query. You cannot use '${e.op.toString()}' filters with '${t.toString()}' filters.`)}var Et=class{convertValue(e,t="none"){switch(C(e)){case 0:return null;case 1:return e.booleanValue;case 2:return g(e.integerValue||e.doubleValue);case 3:return this.convertTimestamp(e.timestampValue);case 4:return this.convertServerTimestamp(e,t);case 5:return e.stringValue;case 6:return this.convertBytes(Z(e.bytesValue));case 7:return this.convertReference(e.referenceValue);case 8:return this.convertGeoPoint(e.geoPointValue);case 9:return this.convertArray(e.arrayValue,t);case 11:return this.convertObject(e.mapValue,t);case 10:return this.convertVectorValue(e.mapValue);default:throw _(62114,{value:e})}}convertObject(e,t){return this.convertObjectMap(e.fields,t)}convertObjectMap(e,t="none"){let r={};return De(e,((i,s)=>{r[i]=this.convertValue(s,t)})),r}convertVectorValue(e){let t=e.fields?.[ge].arrayValue?.values?.map((r=>g(r.doubleValue)));return new x(t)}convertGeoPoint(e){return new F(g(e.latitude),g(e.longitude))}convertArray(e,t){return(e.values||[]).map((r=>this.convertValue(r,t)))}convertServerTimestamp(e,t){switch(t){case"previous":let r=Pn(e);return r==null?null:this.convertValue(r,t);case"estimate":return this.convertTimestamp(ee(e));default:return null}}convertTimestamp(e){let t=O(e);return new A(t.seconds,t.nanos)}convertDocumentKey(e,t){let r=y.fromString(e);I(xn(r),9688,{name:e});let i=new fe(r.get(1),r.get(3)),s=new E(r.popFirst(5));return i.isEqual(t)||Vt(`Document ${s} contains a document reference within a different database (${i.projectId}/${i.database}) which is not supported. It will be treated as a reference in the current database (${t.projectId}/${t.database}) instead.`),s}};var Re=class extends Et{constructor(e){super(),this.firestore=e}convertBytes(e){return new D(e)}convertReference(e){let t=this.convertDocumentKey(e,this.firestore._databaseId);return new T(this.firestore,null,t)}};function kt(n){let e=On((n=It(n,T)).firestore),t=new Re(n.firestore);return kr(e,[n._key]).then((r=>{I(r.length===1,15618);let i=r[0];return new Pe(n.firestore,t,n._key,i.isFoundDocument()?i:null,n.converter)}))}function Qn(n){(function(i){if(i.limitType==="L"&&i.explicitOrderBy.length===0)throw new c(vn,"limitToLast() queries require specifying at least one orderBy() clause")})((n=It(n,G))._query);let e=On(n.firestore),t=new Re(n.firestore);return Nr(e,n._query).then((r=>{let i=r.map((s=>new be(n.firestore,t,s.key,s,n.converter)));return n._query.limitType==="L"&&i.reverse(),new wt(n,i)}))}(function(){(function(t){Q=t})(`${zt}_lite`),Ut(new $t("firestore/lite",((e,{instanceIdentifier:t,options:r})=>{let i=e.getProvider("app").getImmediate(),s=new z(new Be(e.getProvider("auth-internal")),new Qe(i,e.getProvider("app-check-internal")),(function(u,a){if(!Object.prototype.hasOwnProperty.apply(u.options,["projectId"]))throw new c(d,'"projectId" not provided in firebase.initializeApp.');return new fe(u.options.projectId,a)})(i,t),i);return r&&s._setSettings(r),s}),"PUBLIC").setMultipleInstances(!0)),qe("firestore-lite",Xt,""),qe("firestore-lite",Xt,"esm2020")})();function Kn(n,e){if(n.has("sessionCode")||n.has("session")||n.get("view")==="profile")return"";let t=n.get("studio");return["ai","teams","administrators"].includes(t)?t:/\/admin\/(?:index\.html)?$/.test(e.pathname)||t==="1"||e.hash==="#admin"?"staff":""}var Dt=Ln(Oe,Qt),Ur=Jt(Oe,"europe-west1"),Wn=Ht(Ur,"readStudioPanel",{timeout:125e3}),Nt=async(n,e)=>(await kt(St(Dt,n,e))).data(),Fe,Jn=!1;function jr(){let n=new URLSearchParams(location.search),e=Kn(n,location);Jn||n.has("testRound")||!["staff","ai","teams"].includes(e)||(Jn=!0,Fe=(async()=>{await W.authStateReady();let t=W.currentUser;if(!t?.emailVerified)return null;let r=t.email===Kt;if(!r&&!(await kt(St(Dt,"instructors",t.email))).exists()||W.currentUser!==t)return null;let i={getAiSettings:async()=>(await Wn({screen:"ai"})).data,listTeamUsers:async a=>(await Wn({screen:"teams",...a?{pageToken:a}:{}})).data,getDefaults:async()=>await Nt("settings","defaults")??{...Yt},getDefaultTeamComposition:async()=>({teamComposition:(await Nt("studioTeamDefaults",t.uid))?.teamComposition??{}}),listSessions:async a=>{let l=$n(Dt,"sessions");return(await Qn(a?l:Bn(l,zn("owner","==",t.uid)))).docs.map(m=>({code:m.id,...m.data()})).sort((m,V)=>(V.createdAt?.toMillis()||0)-(m.createdAt?.toMillis()||0))}},s=Math.round(performance.now()),o=e==="staff"?{listSessions:i.listSessions(r),getDefaults:i.getDefaults()}:e==="teams"?{listSessions:i.listSessions(r),getDefaultTeamComposition:i.getDefaultTeamComposition(),listTeamUsers:i.listTeamUsers()}:{getAiSettings:i.getAiSettings()};for(let a of Object.values(o))a.catch(()=>{});let u=Nt("profiles",t.uid);return u.catch(()=>{}),{user:t,screen:e,role:r?"admin":"instructor",reads:o,profile:u,readStart:s}})(),Fe.catch(()=>{}))}async function oi(n,e){jr();let t=Fe;Fe=null;let r=await t;return r?.user===n&&r.screen===e&&W.currentUser===n?r:null}export{jr as preloadStudio,oi as takeStudioStartup};
/*! Bundled license information:

@firebase/firestore/dist/lite/index.browser.esm.js:
@firebase/firestore/dist/lite/index.browser.esm.js:
@firebase/firestore/dist/lite/index.browser.esm.js:
@firebase/firestore/dist/lite/index.browser.esm.js:
@firebase/firestore/dist/lite/index.browser.esm.js:
@firebase/firestore/dist/lite/index.browser.esm.js:
@firebase/firestore/dist/lite/index.browser.esm.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/firestore/dist/lite/index.browser.esm.js:
  (**
  * @license
  * Copyright 2020 Google LLC
  *
  * Licensed under the Apache License, Version 2.0 (the "License");
  * you may not use this file except in compliance with the License.
  * You may obtain a copy of the License at
  *
  *   http://www.apache.org/licenses/LICENSE-2.0
  *
  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
  *)
  (**
   * @license
   * Copyright 2017 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/firestore/dist/lite/index.browser.esm.js:
@firebase/firestore/dist/lite/index.browser.esm.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/firestore/dist/lite/index.browser.esm.js:
  (**
   * @license
   * Copyright 2023 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2017 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/firestore/dist/lite/index.browser.esm.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2023 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2025 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/firestore/dist/lite/index.browser.esm.js:
@firebase/firestore/dist/lite/index.browser.esm.js:
@firebase/firestore/dist/lite/index.browser.esm.js:
@firebase/firestore/dist/lite/index.browser.esm.js:
  (**
   * @license
   * Copyright 2022 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/firestore/dist/lite/index.browser.esm.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/firestore/dist/lite/index.browser.esm.js:
  (**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2018 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/firestore/dist/lite/index.browser.esm.js:
  (**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2017 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/firestore/dist/lite/index.browser.esm.js:
@firebase/firestore/dist/lite/index.browser.esm.js:
@firebase/firestore/dist/lite/index.browser.esm.js:
@firebase/firestore/dist/lite/index.browser.esm.js:
@firebase/firestore/dist/lite/index.browser.esm.js:
@firebase/firestore/dist/lite/index.browser.esm.js:
@firebase/firestore/dist/lite/index.browser.esm.js:
@firebase/firestore/dist/lite/index.browser.esm.js:
@firebase/firestore/dist/lite/index.browser.esm.js:
@firebase/firestore/dist/lite/index.browser.esm.js:
@firebase/firestore/dist/lite/index.browser.esm.js:
  (**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/firestore/dist/lite/index.browser.esm.js:
  (**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2022 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/firestore/dist/lite/index.browser.esm.js:
  (**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2017 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2024 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
  * @license
  * Copyright 2017 Google LLC
  *
  * Licensed under the Apache License, Version 2.0 (the "License");
  * you may not use this file except in compliance with the License.
  * You may obtain a copy of the License at
  *
  *   http://www.apache.org/licenses/LICENSE-2.0
  *
  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
  *)

@firebase/firestore/dist/lite/index.browser.esm.js:
  (**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
*/
