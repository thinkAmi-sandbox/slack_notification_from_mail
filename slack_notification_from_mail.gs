const TARGET_LABEL = PropertiesService.getScriptProperties().getProperty("TARGET_LABEL")
const MAIL_FILTER = `label:${TARGET_LABEL} is:unread` // 対象ラベルかつ未読
const GMAIL_LABEL_URL = 'https://mail.google.com/mail/u/0/#label'
const GMAIL_MESSAGE_ID_URL = 'https://mail.google.com/mail/u/0/#search/rfc822msgid:'

// その他、Scriptのプロパティに以下を設定済という前提 (クラシックエディタから設定)
// TARGET_LABEL  検索対象のラベル
// SLACK_BOT_TOKEN  Slackのbot token
// SLACK_NOTIFICATION_TO  Slackの通知先

function main() {
  // 対象スレッドを取得
  const targetThreads = GmailApp.search(MAIL_FILTER, 0, 10)  // 最新より10件

  if (!targetThreads.length) {
    return
  }

  // 対象スレッドから、対象メールのURLを取得
  // const urls = createUrlsFromThreadsByLabel(targetThreads)  // ラベルを使う場合
  const urls = createUrlsFromThreadsByMessageId(targetThreads)  // Message-IDを使う場合

  // デバッグ用途として、実行ログに出力しておく
  console.log(urls)

  // Slackで通知
  const {responseStatusCode, responseBody} = notify(urls)

  if (responseStatusCode === 200 && responseBody.ok) {
    // 全部終わってからメールを既読にする
    targetThreads.map(t => t.markRead())
  } else {
    throw new Error(responseBody.error)
  }
}

function createUrlsFromThreadsByLabel(threads) {
  return threads
  .map(thread => thread.getMessages())
  .flat()  // messagesの配列を平坦化して扱いやすくする
  .map(message => {
    const mailId = message.getId()
    return `${GMAIL_LABEL_URL}/${TARGET_LABEL}/${mailId}`  // ラベルを使ってURL化
  })
}

function createUrlsFromThreadsByMessageId(threads) {
  return threads
  .map(thread => thread.getMessages())
  .flat()  // messagesの配列を平坦化して扱いやすくする
  .map(message => {
    const messageId = message.getHeader('Message-ID')
    return `${GMAIL_MESSAGE_ID_URL}${messageId}`  // Message-IDを使ってURL化
  })
}

function notify(urls) {
  const message = `
  メールが届きましたので、確認してください。

  ${urls.join('\n')}
  `

  const response = callWebApi("chat.postMessage", {
    channel: PropertiesService.getScriptProperties().getProperty("SLACK_NOTIFICATION_TO"),
    text: message
  })

  const responseStatusCode = response.getResponseCode()
  const responseBody = JSON.parse(response.getContentText())

  return {responseStatusCode, responseBody}
}

// 移植
// https://qiita.com/seratch/items/2158cb0abed5b8e12809
function callWebApi(apiMethod, payload) {
  const token = PropertiesService.getScriptProperties().getProperty("SLACK_BOT_TOKEN")
  return UrlFetchApp.fetch(
    `https://www.slack.com/api/${apiMethod}`,
    {
      method: "post",
      contentType: "application/x-www-form-urlencoded",
      headers: { "Authorization": `Bearer ${token}` },
      payload: payload,
    }
  )
}
