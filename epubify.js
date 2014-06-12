require('alchemymvc');

var async = alchemy.use('async'),
    exec  = require('child_process').exec,
    tasks = {},
    fs    = require('fs'),
    fsc   = require('fs-sync'),
    rm    = require('rimraf');

var files = [];

var mogrifyCmd = "mogrify ",
    border = 0;

// Trim out the white
mogrifyCmd += "-fuzz 15% -trim +repage "

// Add a border if wanted
if (border) {
	mogrifyCmd += '-border ' + border + ' ';
}

mogrifyCmd += "-bordercolor '#ffffff' -resize 1200x1600 -background white -gravity center -extent 1200x1600 *.jpg";

for (var i = 2; i < process.argv.length; i++) {
	files.push(process.argv[i]);
}

files.forEach(function(fileName, index) {

	var tempDir = '/tmp/comic-' + index + '/',
	    split   = fileName.split('.'),
	    mainName;

	// Make sure the directory doesn't exist yet
	rm.sync(tempDir);

	// Remove the extension
	split.pop();

	mainName = split.join('.');


	tasks[fileName] = function(next) {

		var cmd = 'unzip -jo "' + fileName + '" -d ' + tempDir,
		    copyTasks = [];

		// Extract the cbz file
		exec(cmd, function(err, result) {

			var images = fs.readdirSync(tempDir),
			    ifiles = [],
			    tasks  = {},
			    edir   = tempDir + 'epub/';

			// Create the target epub dir
			fs.mkdirSync(edir);
			fs.mkdirSync(edir + 'META-INF/');

			writeRoot(edir);

			images.forEach(function(imageFile, i) {

				var extension = imageFile.split('.').pop(),
				    filename  = i + '.' + extension;

				copyTasks[copyTasks.length] = function(copyDone) {
					alchemy.copyFile(tempDir + imageFile, edir + filename, function() {
						copyDone();
					})
				};

				ifiles.push(filename);
				createPage(edir, filename, i);
			});

			fsc.write(edir + 'content.opf', opfContent(mainName, ifiles));
			fsc.write(edir + 'toc.ncx', toc(mainName, ifiles));
			fsc.write(edir + 'mimetype', 'application/epub+zip');
			fsc.write(edir + 'metadata.opf', opfMeta(mainName));

			async.parallel(copyTasks, function() {

				// Resize the files
				exec(mogrifyCmd, {cwd: edir}, function() {

					// Add the mimetype file
					exec('zip -X -0 "' + mainName + '.epub" mimetype', {cwd: edir}, function(err, result) {

						exec('zip -X -0 -r "' + mainName + '.epub" * -x mimetype', {cwd: edir}, function(err, result) {

							var source = edir + mainName + '.epub',
							    target = __dirname + '/' + mainName + '.epub';

							console.log('Converted ' + mainName.bold ' to ePub');

							alchemy.moveFile(source, target, function() {

								// Remove the temporary directory
								rm(tempDir, function() {

								});

								next();
							});
						});
					});
				});
			});
		});
	};
});

function writeRoot(path) {

	var xml = '<?xml version="1.0"?>\n\
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\n\
	<rootfiles>\n\
		<rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>\n\
	</rootfiles>\n\
</container>';

	fsc.write(path + 'META-INF/container.xml', xml);
};

function createPage(path, file, index) {

	var xml = '<?xml version=\'1.0\' encoding=\'utf-8\'?>\n\
<html xmlns="http://www.w3.org/1999/xhtml">\n\
	<head>\n\
		<title>Page #' + (index+1) + '</title>\n\
		<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>\n\
	</head>\n\
	<body>\n\
		<div>\n\
			<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="100%" height="100%" preserveAspectRatio="meet">\n\
				<image xlink:href="' + file + '"/>\n\
			</svg>\n\
		</div>\n\
	</body>\n\
</html>';

	fsc.write(path + 'page_' + index + '.xhtml', xml);
};

function toc(name, files) {

	var xml = '<?xml version=\'1.0\' encoding=\'utf-8\'?>\n\
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="nld">\n\
	<head>\n\
		<meta content="dbe393cc-2592-4380-8d47-214a97da98c7" name="dtb:uid"/>\n\
		<meta content="2" name="dtb:depth"/>\n\
		<meta content="calibre (1.25.0)" name="dtb:generator"/>\n\
		<meta content="0" name="dtb:totalPageCount"/>\n\
		<meta content="0" name="dtb:maxPageNumber"/>\n\
	</head>\n\
	<docTitle>\n\
		<text>' + name + '</text>\n\
	</docTitle>\n\
	<navMap>\n';

	files.forEach(function(fileName, index) {

		xml += '<navPoint class="chapter" id="num_' + index + '" playOrder="' + (index+1) + '">\n\
		<navLabel>\n\
			<text>Page ' + (index + 1) + '</text>\n\
		</navLabel>\n\
		<content src="page_' + index + '.xhtml"/>\n\
	</navPoint>\n';
	});

	xml += '\t</navMap>\n</ncx>';

	return xml;
};

function opfMeta(name) {

		var xml = '<?xml version=\'1.0\' encoding=\'utf-8\'?>\n\
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="uuid_id" version="2.0">\n\
	<metadata xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:opf="http://www.idpf.org/2007/opf" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:calibre="http://calibre.kovidgoyal.net/2009/metadata" xmlns:dc="http://purl.org/dc/elements/1.1/">\n\
		<meta name="calibre:title_sort" content="marvel test"/>\n\
		<dc:language>nl</dc:language>\n\
		<dc:creator opf:role="aut">Unknown</dc:creator>\n\
		<meta name="calibre:timestamp" content="2014-06-10T21:57:29.160059+00:00"/>\n\
		<dc:title>' + name + '</dc:title>\n\
		<meta name="cover" content="cover"/>\n\
		<dc:date>0101-01-01T00:00:00+00:00</dc:date>\n\
		<dc:contributor opf:role="bkp">CBZ to ePub</dc:contributor>\n\
		<dc:identifier id="uuid_id" opf:scheme="uuid">dbe393cc-2592-4380-8d47-214a97da98c7</dc:identifier>\n\
		<dc:identifier opf:scheme="calibre">dbe393cc-2592-4380-8d47-214a97da98c7</dc:identifier>\n\
	</metadata>\n\
	<guide>\n\
		<reference href="0.jpg" title="Omslag" type="cover"/>\n\
	</guide>\n\
</package>';

	return xml;
}

function opfContent(name, files) {

	var xml = '<?xml version=\'1.0\' encoding=\'utf-8\'?>\n\
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="uuid_id" version="2.0">\n\
	<metadata xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:opf="http://www.idpf.org/2007/opf" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:calibre="http://calibre.kovidgoyal.net/2009/metadata" xmlns:dc="http://purl.org/dc/elements/1.1/">\n\
		<meta name="calibre:title_sort" content="marvel test"/>\n\
		<dc:language>nl</dc:language>\n\
		<dc:creator opf:role="aut">Unknown</dc:creator>\n\
		<meta name="calibre:timestamp" content="2014-06-10T21:57:29.160059+00:00"/>\n\
		<dc:title>' + name + '</dc:title>\n\
		<meta name="cover" content="cover"/>\n\
		<dc:date>0101-01-01T00:00:00+00:00</dc:date>\n\
		<dc:contributor opf:role="bkp">CBZ to ePub</dc:contributor>\n\
		<dc:identifier id="uuid_id" opf:scheme="uuid">dbe393cc-2592-4380-8d47-214a97da98c7</dc:identifier>\n\
		<dc:identifier opf:scheme="calibre">dbe393cc-2592-4380-8d47-214a97da98c7</dc:identifier>\n\
	</metadata>\n\
	<manifest>\n';

	var images = '',
	    pages  = '',
	    spine  = '';

	files.forEach(function(fileName, index) {

		images += '\t\t<item href="' + fileName + '" id="id' + index + '" media-type="image/jpeg"/>\n';
		pages += '\t\t<item href="page_' + index + '.xhtml" id="page' + index + '" media-type="application/xhtml+xml"/>\n';

		spine += '\t\t<itemref idref="page' + index + '"/>\n';

	});

	xml += images + pages;

	xml += '\t\t<item href="toc.ncx" id="ncx" media-type="application/x-dtbncx+xml"/>\n';

	xml += '\t</manifest>\n';

	xml += '\t<spine toc="ncx">\n';
	xml += spine;
	xml += '\t</spine>\n';

	xml += '\t<guide>\n\t\t<reference href="page_0.xhtml" title="Cover" type="cover"/>\n\t</guide>\n';

	xml += '</package>';

	return xml;
}

async.parallelLimit(tasks, 3, function(err, result) {
	console.log('Converted ' + Object.keys(result).length + ' CBZ files to ePub');
	process.exit();
});