JS_DEPS := node_modules
JS_SRCS := $(wildcard src/*.js)
JS_SRCS += $(wildcard src/*/*.js)


BROWSERIFY := npx browserify

.DEFAULT_GOAL := index.js

# Track an empty file as a timestamp of the last `npm install`
$(JS_DEPS)/.stamp: package.json package-lock.json
	npm install
	touch $@

clean:
	rm -fr \
	  index.js \
	  node_modules \
	  pcbdata.json

index.js: $(JS_DEPS)/.stamp $(JS_SRCS) pcbdata.json
	$(BROWSERIFY) ./src/ibom.js ./src/render.js ./src/htmlFunctions.js ./src/pcb.js ./src/colormap.js --debug --outfile $@

pcbdata.json: ../Examples/Eagle/Simple_BRD/pcbdata.json
	cp $< $@


print-%  : ; @echo $* = $($*)