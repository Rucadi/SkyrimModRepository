var REPO_BASE = null;

var PAGE_CACHE = new Map();

/*UTILS*/


function throttle (func, wait) {
    let ctx, args, rtn, timeoutID // caching
    let last = 0
  
    return function throttled () {
      ctx = this
      args = arguments
      const delta = new Date() - last
      if (!timeoutID) {
        if (delta >= wait) call()
        else timeoutID = setTimeout(call, wait - delta)
      }
      return rtn
    }
  
    function call () {
      timeoutID = 0
      last = +new Date()
      rtn = func.apply(ctx, args)
      ctx = null
      args = null
    }
  }
  
  const saveData = (function () {
    const a = document.createElement('a')
    document.body.appendChild(a)
    a.style = 'display: none'
    return function (url, fileName) {
      a.href = url
      a.download = fileName
      a.click()
      window.URL.revokeObjectURL(url)
    }
  })()

/*CONFIGS*/

const repositoryDatabaseHash = '029fb8ae2fb2e19ccf923d41f5c3614492e38567'

const announceList = [
  ['wss://tracker.btorrent.xyz'],
  ['wss://tracker.openwebtorrent.com']]

globalThis.WEBTORRENT_ANNOUNCE = announceList
  .map(function (arr) {
    return arr[0]
  })
  .filter(function (url) {
    return url.indexOf('wss://') === 0 || url.indexOf('ws://') === 0
  })

const client = new WebTorrent({
  tracker: {
    rtcConfig: {
      ...SimplePeer.config
    }
  }
})


//Get a file with a name of a downloaded torrent
function getTorrentFile (torrent, fileName) {
  return torrent.files.find((file) => file.name === fileName)
}

//callback that processes the contesnts of a file of a downloaded content
function processTorrentFile (torrent, fileName, cb) {
  getTorrentFile(torrent, fileName).getBuffer((err, buffer) => cb(buffer))
}

function createDownloadCardHtml (version) {
  let card_html = ''
  card_html += '<div class="card" style="width: 20rem;">'
  card_html += '<div class="card-body">'
  card_html += '<h5 class="card-title">' + version.name + ' ' + version.version + '</h5>'
  card_html += '<p class="card-text" >' + version.description + '</p>'
  card_html += '<div id="' + version.hash + '"> <a href="#" onclick="handleTorrentDownload("' + version.hash + '"") class="btn btn-primary d-flex justify-content-center flex-nowrap" style="  margin-top: 10px; margin-bottom: 10px;">download</a></div>'
  card_html += '<a target="_blank" href="https://instant.io/#' + version.hash + '" class="btn btn-primary d-flex justify-content-center flex-nowrap" style="  margin-top: 10px; margin-bottom: 10px;">magnet</a>'
  card_html += '</div> </div>'
  return card_html
}

function processModJson (data) {
  const mod = JSON.parse(data.toString())
  document.getElementById('mod-alternatives-title').innerHTML = mod.name
  for (const version of mod.versions) {
    document.getElementById('mod-alternatives-downloads').innerHTML += createDownloadCardHtml(version)
  }
}

function replaceImagesByBlobs (torrent) {
  const imgs = document.getElementById('mod-alternatives-content').getElementsByTagName('img')
  for (let i = 0; i < imgs.length; i++) {
    getTorrentFile(torrent, imgs[i].src.split('/').pop()).getBlobURL((err, url) => imgs[i].src = url)
  }
}

function onDownloaded (torrent) {
  processTorrentFile(torrent, 'README.md', (buffer) => {
    const converter = new showdown.Converter()
    const text = converter.makeHtml(buffer.toString())
    document.getElementById('mod-alternatives-content').innerHTML = text
    processTorrentFile(torrent, 'mod.json', processModJson)
    replaceImagesByBlobs(torrent)
  })
}

function loadModPage (magnet) {

   window.location.hash = magnet
  document.getElementById('mod-alternatives-downloads').innerHTML = ''
  document.getElementById('mod-alternatives-content').innerHTML = ''
  document.getElementById('mod-alternatives-title').innerHTML = 'Downloading mod info from peers...'

  if(PAGE_CACHE.get(magnet) === undefined) client.add(magnet, (torrent) => torrent.on('done', () => {PAGE_CACHE.set(magnet, torrent); onDownloaded(torrent)}))
  else onDownloaded(PAGE_CACHE.get(magnet))
}




function handleTorrentDownload (hash) {
  document.getElementById(hash).innerHTML = "<div class='progress'> <div class='progress-bar'  role='progressbar' style='width: " + 0 + "%;'' aria-valuenow='" + 0 + "' aria-valuemin='0' aria-valuemax='100'>" + 0 + '</div> </div>'
  function onTorrentAdded (torrent) {
    console.log('ontorrentadd')

    function updateSpeed () {
      const progress = (100 * torrent.progress).toFixed(1)

      if (!torrent.done) { document.getElementById(hash).innerHTML = "<div class='progress'> <div class='progress-bar'  role='progressbar' style='width: " + progress + "%;'' aria-valuenow='" + progress + "' aria-valuemin='0' aria-valuemax='100'>" + progress + '</div> </div>' }

    }

    encapsulateStr = (str) => '\'' + str + '\''
    function onDone () {
      console.log('OnDone')

      if (torrent.files.length > 1) {
        const zip = new JSZip()
        for (let i = 0; i < torrent.files.length; i++) {
          zip.file(torrent.files[i].name, torrent.files[i].getBlob())
        }
        zip.generateAsync({ type: 'blob' }).then(function (content) {
          document.getElementById(hash).innerHTML = '<a href="#" onclick="saveData(' + encapsulateStr(window.URL.createObjectURL(content)) + ',' + encapsulateStr(torrent.infoHash + '.zip') + ')" class="btn btn-primary d-flex justify-content-center flex-nowrap" style="  margin-top: 10px; margin-bottom: 10px;">Save To Disk</a></div>'
        })
      } else {
        torrent.files[0].getBlobURL((err, url) => {
          document.getElementById(hash).innerHTML = '<a href="#" onclick="saveData(' + encapsulateStr(url) + ',' + encapsulateStr(torrent.name) + ')" class="btn btn-primary d-flex justify-content-center flex-nowrap" style="  margin-top: 10px; margin-bottom: 10px;">Save To Disk</a></div>'
        })
      }
    }
    torrent.on('download', throttle(updateSpeed, 250))
    torrent.on('done', () => onDone())
  }

  console.log('adding torrent')
  client.add(hash, onTorrentAdded)
}






  
function tryLoadRepository()
{
    if(REPO_BASE === null)
    client.add(repositoryDatabaseHash, (torrent) => {
        console.log('added database torrent')
        torrent.on('done', () => {
          processTorrentFile(torrent, 'SkyrimModAlternatives.json', (buffer) => {
            console.log(buffer.toString())
            REPO_BASE = JSON.parse(buffer);
            loadRepository();
          })
        })
      })
    else loadRepository();
    
}


function loadRepository()
{
    let REPO_FILTERED = JSON.parse(JSON.stringify(REPO_BASE));
    REPO_FILTERED.mods.reverse();

    document.getElementById('mod-alternatives-downloads').innerHTML = ''
    document.getElementById('mod-alternatives-content').innerHTML = ''
    document.getElementById('mod-alternatives-title').innerHTML = 'Skyrim Mod Repository'
    document.getElementById('mod-alternatives-content').innerHTML = "<ul id='mod-alternatives-repo-list' style='overflow-y: scroll; height: 70vh'></ul>"

    var listElm = document.getElementById('mod-alternatives-repo-list')

    // Add 20 items maximum
    var loadMore = function() {

        for (var i = 0; i < 20 && REPO_FILTERED.mods.length >=1 ; i++) {
            var mod = REPO_FILTERED.mods.pop();
            var item = document.createElement('li')
            item.onclick = ()=> loadModPage(mod.Hash);
            item.innerText = 'Mod: '+mod.Name
            listElm.appendChild(item);
        }
    }
    loadMore();

    // Detect when scrolled to bottom.
    listElm.addEventListener('scroll', function() {
        console.log("scrolled")

    console.log(listElm.scrollTop + listElm.clientHeight,"  ", listElm.scrollHeight)
    if (listElm.scrollTop + listElm.clientHeight >= listElm.scrollHeight) {
        loadMore();
    }
    });
}


if(window.location.hash === '#' || window.location.hash === '')
    tryLoadRepository();
loadModPage(window.location.hash.substring(1))


