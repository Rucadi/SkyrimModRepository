let REPO_BASE = null
let REPO_FILTERED = null
let PAGE_CACHE = new Map()
let PREVIEW_CACHE = new Map()

/* UTILS */


let current_repository = document.getElementById('mod-database-repo').value

encapsulateStr = (str) => '\'' + str + '\''

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

/* CONFIGS */

let repositoryDatabaseHash = '3bf797e2c633110b949abb33f1b123ce37e54800'

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

let client = new WebTorrent({
  tracker: {
    rtcConfig: {
      ...SimplePeer.config
    }
  }
})

// Get a file with a name of a downloaded torrent
function getTorrentFile (torrent, fileName) {
  return torrent.files.find((file) => file.name === fileName)
}

function getTorrentFileAt (torrent, idx) {
  return torrent.files[idx]
}

// callback that processes the contesnts of a file of a downloaded content
function processTorrentFile (torrent, fileName, cb) {
  getTorrentFile(torrent, fileName).getBuffer((err, buffer) => cb(buffer))
}

function processTorrentFileAt (torrent, idx, cb) {
  torrent.files[idx].getBuffer((err, buffer) => cb(buffer))
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
  console.log('magnet load page ', magnet)
  window.location.hash = magnet
  document.getElementById('mod-alternatives-downloads').innerHTML = ''
  document.getElementById('mod-alternatives-content').innerHTML = ''
  document.getElementById('mod-alternatives-title').innerHTML = 'Downloading mod info from peers...'

  if (PAGE_CACHE.get(magnet) === undefined) client.add(magnet, (torrent) => torrent.on('done', () => { PAGE_CACHE.set(magnet, torrent); onDownloaded(torrent) }))
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

function tryLoadRepository () 
{
  //If we changed repositories, reinitialize
  let new_repository = document.getElementById('mod-database-repo').value;
  if(new_repository != current_repository)
  {
    REPO_BASE = null
    REPO_FILTERED = null
    PAGE_CACHE = new Map()
    PREVIEW_CACHE = new Map()
  
    if(client != null) client.destroy();
     client = new WebTorrent({
      tracker: {
        rtcConfig: {
          ...SimplePeer.config
        }
      }
    })

    current_repository = new_repository;
  }

  document.getElementById('mod-alternatives-downloads').innerHTML = ''
  document.getElementById('mod-alternatives-content').innerHTML = ''
  document.getElementById('mod-alternatives-title').innerHTML = 'Skyrim Mod Repository'
  document.getElementById('mod-alternatives-content').innerHTML = "<input type='text' style='width:100%' id='mod-alternatives-search' onkeypress='filterMods()'/> <div id='mod-alternatives-repo-list' style='overflow-y: scroll; height: 70vh; display: flex; flex-wrap: wrap;'></div>"

  if (REPO_BASE === null) {
    client.add(document.getElementById('mod-database-repo').value, (torrent) => {
      console.log('added database torrent')
      torrent.on('done', () => {
        processTorrentFile(torrent, 'SkyrimModAlternatives.json', (buffer) => {
          console.log(buffer.toString())
          REPO_BASE = JSON.parse(buffer)
          loadModView(JSON.parse(JSON.stringify(REPO_BASE.mods)))
        })
      })
    })
  } else 
    {
      loadModView(JSON.parse(JSON.stringify(REPO_BASE.mods)))
    }
}

function createModEntry (mod, imageIdentifier) {
  /*
 {
      "Name": "SkyrimModAlternatives Example",
      "Description": "global description of the mod",
      "Type": "Clothing",
      "SkyrimVersion": [
        "AE",
        "SE"
      ],
      "Hash": "6b284c4347f6246514179779cd14a24815ec2f5a",
      "NSFW": false,
      "Author": "author",
      "Permission": "None"
    } */

  // string with the two supported SkyrimVersion

  let modEntry = "<div class='card' style='min-width: 18rem; max-width: 18rem;  max-height: 26rem; display: flex;     margin-bottom: 20px;    '>"
  modEntry += "<img  id='" + imageIdentifier + "' style='min-width: 18rem; min-height: 16rem; object-fit: fill' >"
  modEntry += "<div style='padding: 5px'>"
  modEntry += "<h5 class='card-title'> " + mod.Name + '</h5>'
  modEntry += "<p class='card-text'>" + mod.Description + '</p>'
  modEntry += '</div>'
  modEntry += '</div>'

  return modEntry
}


function filterMods()
{
  loadModView(JSON.parse(JSON.stringify(REPO_BASE.mods)).filter((mod) => mod.Name.toLowerCase().includes(document.getElementById('mod-alternatives-search').value.toLowerCase())).reverse());
}



function loadModView (REPO_FILTERED) {
  const listElm = document.getElementById('mod-alternatives-repo-list')
  listElm.innerHTML = ''

  const loadMore = function () {
    
    for (let i = 0; i < 20 && REPO_FILTERED.length >= 1; i++) {
      var mod = REPO_FILTERED[0];
        const imageIdentifier = "image-"+mod.ImagePreview;

        const item = document.createElement('div')
        item.style.margin = 'auto'
        item.onclick = () => loadModPage(mod.Hash)
        item.innerHTML = createModEntry(mod, imageIdentifier)
        listElm.appendChild(item)
      
        function imageItemSubs(_, url)
        {
          PREVIEW_CACHE.set(mod.ImagePreview, url)
          document.querySelectorAll('[id='+imageIdentifier+']').forEach(element=> 
            element.src = url
          );
        }

      if (PREVIEW_CACHE.get(mod.ImagePreview) == undefined) {
        PREVIEW_CACHE.set(mod.ImagePreview, 'pending')
        client.add(mod.ImagePreview, (torrent) => 
        {
          torrent.on('done', () =>{
            getTorrentFileAt(torrent, 0).getBlobURL(imageItemSubs)
          });
        })
      } else {
        checkIfFinished = () => {
          if (PREVIEW_CACHE.get(mod.ImagePreview) == 'pending') setTimeout(checkIfFinished, 100)
          else imageItemSubs(null, PREVIEW_CACHE.get(mod.ImagePreview))
        }
        checkIfFinished()
      }
    }
  }
  loadMore()

  // Detect when scrolled to bottom.
  listElm.addEventListener('scroll', function () {

   //console.log(listElm.scrollTop + listElm.clientHeight, '  ', listElm.scrollHeight)
    if (listElm.scrollTop + listElm.clientHeight >= listElm.scrollHeight - 300) {
      loadMore()
    }
  })
}

if (window.location.hash === '#' || window.location.hash === '') { tryLoadRepository() } else loadModPage(window.location.hash.substring(1))
