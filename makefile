
PACKAGE = vmcjs

# Get the Major/Release/Hotfix numbers from package.json.
PKG_VER:=$(shell grep version package.json| sed s/\"//g| sed s/version://g| sed s/-BUILD-NUMBER//g| tr -d ' '| tr -d ',') 
MAJOR:=$(shell echo $(PKG_VER)| cut -d '.' -f1)
RELEASE:=$(shell echo $(PKG_VER)| cut -d '.' -f2)
HOTFIX:=$(shell echo $(PKG_VER)| cut -d '.' -f3)

VERSION = $(MAJOR).$(RELEASE).$(HOTFIX)
DIST_DIR  = ./dist
OUTPUT_DIR  = ./output
MODULES = ./node_modules
COV_DIR = ./lib-cov
RELEASE_FILE = $(PACKAGE)-$(VERSION).tar.gz
RELEASE_DIR = $(PACKAGE)-$(VERSION)

all: clean npm_deps test 

test:
	env NODE_PATH=`pwd`/lib expresso

dist: npm_deps
	rm -rf $(DIST_DIR) $(OUTPUT_DIR)
	mkdir -p $(DIST_DIR) $(OUTPUT_DIR)/$(RELEASE_DIR)
	cp -r ./lib $(OUTPUT_DIR)/$(RELEASE_DIR)
	cp ./package.json $(OUTPUT_DIR)/$(RELEASE_DIR)
	tar -czf $(DIST_DIR)/$(RELEASE_FILE) -C $(OUTPUT_DIR) $(RELEASE_DIR)

npm_deps:
	npm install .

clean:
	rm -rf $(MODULES) $(COV_DIR) $(OUTPUT_DIR) $(DIST_DIR)

.PHONY: test dist clean npm_deps 
