echo
echo 'Compiling LESS to CSS...'
lessc cloudcache/assets/less/build.less > cc-temp.css

echo
echo 'Combining all CSS...'
for f in cloudcache/assets/css/*.css; do (cat "${f}"; echo) >> temp.css; done
cat cc-temp.css >> temp.css
rm cc-temp.css

echo
echo 'Minifying CSS...'
cleancss --skip-rebase -o cloudcache/static/css/cc.min.css temp.css
rm temp.css

echo
echo 'Concatenating and minifying Javascript...'
uglifyjs cloudcache/assets/js/jquery-2.1.0.min.js cloudcache/assets/js/bootstrap.min.js cloudcache/assets/js/bootstrap-notify.min.js cloudcache/assets/js/bootstrap-treeview.js cloudcache/assets/js/enquire.min.js cloudcache/assets/js/jquery.contextMenu.min.js cloudcache/assets/js/jquery-ui.min.js cloudcache/assets/js/slideout.min.js cloudcache/assets/js/handlebars.js cloudcache/assets/js/cloudcache/app.js cloudcache/assets/js/cloudcache/core.js -c -o cloudcache/static/js/cc.min.js 2> err.tmp
cat err.tmp | grep -v WARN | grep -v 'Use console.error instead'
rm err.tmp
