import * as request from 'supertest'
import * as shutdown from 'http-graceful-shutdown'
import { MessageModel } from '@/models/Message'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { Mongoose } from 'mongoose'
import { Server } from 'http'
import { ValidationError } from 'amala'
import runApp from '@/helpers/runApp'
import runMongo from '@/helpers/mongo'

describe('CRUD test', () => {
  let server: Server
  let mongoServer: MongoMemoryServer
  let mongoose: Mongoose

  const user = {
    email: 'testcrud@gmail.com',
    name: 'crudTest',
  }

  let token: string
  let author: string
  let messageId: string

  const text = 'yoba, eto ti?'
  const postText = { text: 'hello yoba' }
  const putText = { text: 'da, eto ya!' }

  const unregisteredToken =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjYzMGZlMTY2MTIwODExNzg2OGVlNjgxMyIsImlhdCI6MTY2MTk4NTEyNn0.W3E_w2wzrkkcGCmkot_dvlU2v46OjDhQgI6nAHhSvdQ'

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create()
    mongoose = await runMongo(mongoServer.getUri())
    server = await runApp()
  })

  beforeEach(async () => {
    const response = await request(server).post('/login/email').send(user)
    token = response.body.token
    author = response.body._id
    const message = await MessageModel.create({ text, author })
    messageId = message._id
  })

  afterEach(async () => {
    await mongoose.connection.db.dropDatabase()
  })

  afterAll(async () => {
    await shutdown(server)
    await mongoServer.stop()
    return new Promise<void>((resolve, reject) => {
      server.close((err) => {
        err ? reject(err) : resolve()
      })
    })
  })

  it("returns user's messages correctly", async () => {
    const response = await request(server).get('/crud').set('token', token)
    expect(response.statusCode).toBe(200)
    expect(response.body.length).toBe(1)
    expect(response.body[0].text).toBe('yoba, eto ti?')
    expect(response.body[0].author).toBe(author)
  })

  it('checks the appearance of new message in DB', async () => {
    const response = await request(server)
      .post('/crud')
      .send(postText)
      .set('token', token)

    const newMessageId = response.body._id
    const newMessage = await MessageModel.findById(newMessageId)

    expect(newMessage).not.toBeNull()
    expect(response.body.text).toBe(postText.text)
    expect(response.body.author._id).toBe(author)
  })

  it('checks update of existing message', async () => {
    const response = await request(server)
      .put(`/crud/${messageId}`)
      .send(putText)
      .set('token', token)

    expect(response.body.text).toBe(text)

    const updatedMessage = await MessageModel.findById(messageId)
    expect(updatedMessage?.text).toBe(putText.text)
  })

  it('testing DELETE of existing message', async () => {
    const response = await request(server)
      .delete(`/crud/${messageId}`)
      .set('token', token)

    expect(response.body.text).toBe(text)

    const deletedMessage = await MessageModel.findById(messageId)
    expect(deletedMessage).toBeNull()
  })

  it('testing get request without token', async () => {
    const response = await request(server).get('/crud')

    expect(response.statusCode).toBe(404)
  })

  it('testing post with unregistered token', async () => {
    const response = await request(server)
      .post('/crud')
      .send(postText)
      .set('token', unregisteredToken)

    expect(response.statusCode).toBe(404)
  })
})